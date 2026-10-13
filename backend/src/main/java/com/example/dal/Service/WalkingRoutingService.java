package com.example.dal.Service;

import com.example.dal.DtoOut.NavigationResult.Route;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.*;

@Service
public class WalkingRoutingService {
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
        this(apiKey, "https://api.openrouteservice.org");
    }
    WalkingRoutingService(String apiKey, String baseUrl) {
        this.apiKey = apiKey;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1500); factory.setReadTimeout(4500);
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
        try {
            Map<?,?> response = client.post().uri("/v2/directions/foot-walking/geojson").header("Authorization", apiKey)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("coordinates", List.of(List.of(longitude, latitude), List.of(targetLongitude, targetLatitude)), "instructions", false))
                .retrieve().body(Map.class);
            result = parse(response);
        } catch (RuntimeException e) { result = Route.unavailable("تعذر حساب طريق المشي. تحقق من الاتصال أو أعد المحاولة لاحقًا."); }
        synchronized (this) {
            inFlight.remove(key);
            if (cache.size() >= 128) cache.remove(cache.keySet().iterator().next());
            cache.put(key, new Cached(System.currentTimeMillis(), result));
        }
        return result;
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
