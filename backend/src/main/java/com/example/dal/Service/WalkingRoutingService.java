package com.example.dal.Service;

import com.example.dal.DtoOut.NavigationResult.Route;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.UnknownContentTypeException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.*;

@Service
public class WalkingRoutingService {
    private static final Logger LOGGER = LoggerFactory.getLogger(WalkingRoutingService.class);
    private final String apiKey;
    private final RestClient client;
    private record Cached(long time, Route route) {}
    // Short-lived, bounded, in-memory cache. Never persisted or logged.
    private final Map<String, Cached> cache = new LinkedHashMap<>();
    private final Set<String> inFlight = new HashSet<>();
    private long window, day;
    private int requests, dailyRequests;

    @org.springframework.beans.factory.annotation.Autowired
    public WalkingRoutingService(@Value("${OPENROUTESERVICE_API_KEY:}") String apiKey) {
        this(apiKey, "https://api.heigit.org/openrouteservice");
    }
    WalkingRoutingService(String apiKey, String baseUrl) {
        this.apiKey = apiKey;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000); factory.setReadTimeout(9000);
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    public synchronized Optional<Route> cachedRoute(double latitude,double longitude,double targetLatitude,double targetLongitude) {
        Cached value=cache.get(latitude+":"+longitude+":"+targetLatitude+":"+targetLongitude);
        return value!=null&&System.currentTimeMillis()-value.time()<30000&&"READY".equals(value.route().status())?Optional.of(value.route()):Optional.empty();
    }
    public Route route(double latitude, double longitude, double targetLatitude, double targetLongitude) {
        if (!valid(latitude, longitude) || !valid(targetLatitude, targetLongitude)) return Route.unavailable("إحداثيات المسار غير متاحة.");
        if (apiKey.isBlank()) return Route.unavailable("خدمة طريق المشي غير مهيأة حاليًا.");
        long now = System.currentTimeMillis();
        String key = latitude+":"+longitude+":"+targetLatitude+":"+targetLongitude;
        synchronized (this) {
        cache.entrySet().removeIf(e -> now-e.getValue().time() >= 30000);
        Cached previous = cache.get(key);
        if (previous != null) return previous.route();
        if (inFlight.contains(key)) return Route.unavailable("جارٍ حساب هذا المسار؛ أعد المحاولة بعد قليل.");
        if (window != now/60000) { window=now/60000; requests=0; }
        if (day != now/86400000) { day=now/86400000; dailyRequests=0; }
        // Conservative local budget; provider/account quotas may be lower.
        if (requests >= 30 || dailyRequests >= 1500) return Route.unavailable("بلغت الخدمة حد الطلبات المحلي. حاول لاحقًا.");
        requests++; dailyRequests++;
        inFlight.add(key);
        }
        Route result;
        long started = System.nanoTime();
        try {
            Map<?,?> response = client.post().uri("/v2/directions/foot-walking/geojson").header("Authorization", apiKey)
                .accept(MediaType.parseMediaType("application/geo+json"), MediaType.APPLICATION_JSON)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("coordinates", List.of(List.of(longitude, latitude), List.of(targetLongitude, targetLatitude)), "instructions", false))
                .retrieve().body(Map.class);
            try { result = parse(response); }
            catch (RuntimeException e) { result = failure("GEOJSON_PARSING", null, started); }
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            String category = switch (status) {
                case 401, 403 -> "AUTHORIZATION";
                case 404, 405 -> "ENDPOINT_METHOD";
                case 429 -> "RATE_LIMIT";
                default -> status >= 500 && status < 600 ? "PROVIDER_5XX" : "HTTP_OTHER";
            };
            result = failure(category, status, started);
        } catch (ResourceAccessException e) {
            result = failure(timedOut(e) ? "TIMEOUT" : "NETWORK", null, started);
        } catch (RestClientException e) {
            String category = timedOut(e) ? "TIMEOUT"
                : (e instanceof UnknownContentTypeException || causedBy(e, HttpMessageNotReadableException.class)) ? "GEOJSON_PARSING" : "CLIENT_ERROR";
            result = failure(category, null, started);
        } catch (RuntimeException e) { result = failure("CLIENT_ERROR", null, started); }
        synchronized (this) {
            inFlight.remove(key);
            if (cache.size() >= 128) cache.remove(cache.keySet().iterator().next());
            cache.put(key, new Cached(System.currentTimeMillis(), result));
        }
        return result;
    }
    private static boolean causedBy(Throwable error, Class<? extends Throwable> type) {
        for (int depth=0; error!=null && depth<16; depth++, error=error.getCause()) if (type.isInstance(error)) return true;
        return false;
    }
    private static boolean timedOut(Throwable error) {
        return causedBy(error, SocketTimeoutException.class) || causedBy(error, HttpTimeoutException.class);
    }
    private static Route failure(String category, Integer status, long started) {
        // Deliberately omit exception messages/stack traces, headers, URLs, bodies, identities and coordinates.
        LOGGER.warn("ORS walking failure category={} http_status={} elapsed_ms={} request_id={}",
            category, status == null ? "unavailable" : status, (System.nanoTime()-started)/1_000_000, UUID.randomUUID());
        String message = switch (category) {
            case "TIMEOUT" -> "استغرق حساب طريق المشي وقتًا أطول من المتاح. حاول لاحقًا.";
            case "NETWORK" -> "تعذر الاتصال بخدمة طريق المشي. حاول لاحقًا.";
            case "RATE_LIMIT", "PROVIDER_5XX" -> "خدمة طريق المشي مشغولة أو غير متاحة مؤقتًا. حاول لاحقًا.";
            default -> "تعذر حساب طريق المشي حاليًا. يمكنك استخدام الاتجاه المباشر أو المحاولة لاحقًا.";
        };
        return Route.unavailable(message);
    }
    static Route parse(Map<?,?> response) {
        Map<?,?> feature = (Map<?,?>)((List<?>)response.get("features")).get(0);
        Map<?,?> geometry = (Map<?,?>)feature.get("geometry");
        if (!"LineString".equals(geometry.get("type"))) throw new IllegalArgumentException("Invalid route geometry");
        List<?> raw = (List<?>)geometry.get("coordinates");
        if (raw.size()<2 || raw.size()>20000) throw new IllegalArgumentException("Invalid route size");
        List<List<Double>> points = new ArrayList<>();
        for (Object item:raw) {
            List<?> coordinate=(List<?>)item;
            double lon=((Number)coordinate.get(0)).doubleValue(), lat=((Number)coordinate.get(1)).doubleValue();
            if (!valid(lat,lon)) throw new IllegalArgumentException("Invalid route coordinate");
            points.add(List.of(lat,lon));
        }
        Map<?,?> summary=(Map<?,?>)((Map<?,?>)feature.get("properties")).get("summary");
        double distance=((Number)summary.get("distance")).doubleValue(), seconds=((Number)summary.get("duration")).doubleValue();
        if (!Double.isFinite(distance)||distance<0||!Double.isFinite(seconds)||seconds<0) throw new IllegalArgumentException("Invalid route summary");
        return new Route("READY", points, distance, seconds, "بيانات OpenRouteService/OpenStreetMap الخارجية لا تضمن تغطية ممرات إكسبو الداخلية أو صلاحية المرور الحالية.", false);
    }
    static boolean valid(double latitude,double longitude) { return Double.isFinite(latitude)&&Math.abs(latitude)<=90&&Double.isFinite(longitude)&&Math.abs(longitude)<=180; }
}
