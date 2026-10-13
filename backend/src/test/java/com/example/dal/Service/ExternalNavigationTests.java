package com.example.dal.Service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;

class ExternalNavigationTests {
    @Test void stalledProvidersTimeOutAndReturnFallbacks() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        var executor=java.util.concurrent.Executors.newCachedThreadPool();server.setExecutor(executor);
        server.createContext("/",exchange->{try {Thread.sleep(7000);}catch(InterruptedException e){Thread.currentThread().interrupt();}finally{exchange.close();}});server.start();
        try {String base="http://127.0.0.1:"+server.getAddress().getPort();long start=System.currentTimeMillis();assertEquals("UNAVAILABLE",new WalkingRoutingService("test",base).route(24,46,24.1,46.1).status());assertTrue(System.currentTimeMillis()-start<6500);start=System.currentTimeMillis();assertTrue(new AiExplanationService("test","gpt-4.1-mini",base).explain(Map.of()).isEmpty());assertTrue(System.currentTimeMillis()-start<6500);}
        finally {server.stop(0);executor.shutdownNow();}
    }
    @Test void walkingUsesFootProfileLongitudeFirstCachesAndNeverInventsFailureMetrics() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);AtomicInteger calls=new AtomicInteger();AtomicReference<String> request=new AtomicReference<>();
        server.createContext("/openrouteservice/v2/directions/foot-walking/geojson",exchange->{calls.incrementAndGet();request.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));assertEquals("POST",exchange.getRequestMethod());assertEquals("test-key",exchange.getRequestHeaders().getFirst("Authorization"));assertTrue(exchange.getRequestHeaders().getFirst("Content-Type").startsWith("application/json"));assertTrue(exchange.getRequestHeaders().getFirst("Accept").contains("application/geo+json"));byte[] body="{\"type\":\"FeatureCollection\",\"features\":[{\"type\":\"Feature\",\"geometry\":{\"type\":\"LineString\",\"coordinates\":[[46,24],[46.001,24.001]]},\"properties\":{\"summary\":{\"distance\":150,\"duration\":120}}}]}".getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/geo+json; charset=UTF-8");exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();});
        server.start();try {
            var service=new WalkingRoutingService("test-key","http://127.0.0.1:"+server.getAddress().getPort()+"/openrouteservice");
            var route=service.route(24,46,24.001,46.001);assertEquals("READY",route.status());assertEquals(List.of(24.0,46.0),route.coordinates().get(0));assertEquals(150,route.distanceMeters());assertTrue(request.get().contains("[[46.0,24.0],[46.001,24.001]]"));
            service.route(24,46,24.001,46.001);assertEquals(1,calls.get());service.route(24,46,24.002,46.001);assertEquals(2,calls.get());
            assertEquals("UNAVAILABLE",service.route(Double.NaN,46,24,46).status());
        } finally {server.stop(0);}
        var unavailable=new WalkingRoutingService("","http://127.0.0.1:1").route(24,46,24.1,46.1);assertNull(unavailable.distanceMeters());assertNull(unavailable.durationSeconds());
        assertEquals("UNAVAILABLE",new WalkingRoutingService("test","http://127.0.0.1:1").route(24,46,24.1,46.1).status());
    }
    @Test void openAiUsesStructuredStatelessFactsAndHandlesInvalidOrUnavailableResponses() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);AtomicReference<String> request=new AtomicReference<>();AtomicBoolean invalid=new AtomicBoolean();
        server.createContext("/v1/responses",exchange->{request.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));String text=invalid.get()?"{}":"{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"{\\\"reason\\\":\\\"بيانات قديمة\\\"}\"}]}]}";byte[] body=text.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();});server.start();
        try {var service=new AiExplanationService("test","gpt-4.1-mini","http://127.0.0.1:"+server.getAddress().getPort());assertEquals("بيانات قديمة",service.explain(Map.of("ageSeconds",240,"lowAccuracy",true)).orElseThrow());assertTrue(request.get().contains("\"store\":false"));assertTrue(request.get().contains("json_schema"));assertFalse(request.get().contains("latitude"));invalid.set(true);assertTrue(service.explain(Map.of()).isEmpty());}
        finally {server.stop(0);}
        assertTrue(new AiExplanationService("","gpt-4.1-mini","http://127.0.0.1:1").explain(Map.of()).isEmpty());assertTrue(new AiExplanationService("test","gpt-4.1-mini","http://127.0.0.1:1").explain(Map.of()).isEmpty());
    }
}
