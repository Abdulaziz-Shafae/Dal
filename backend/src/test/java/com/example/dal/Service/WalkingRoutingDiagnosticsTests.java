package com.example.dal.Service;

import com.example.dal.DtoOut.NavigationResult.Route;
import com.sun.net.httpserver.HttpServer;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import static org.junit.jupiter.api.Assertions.*;

class WalkingRoutingDiagnosticsTests {
    private static final String KEY="PRIVATE_QA_KEY_DO_NOT_LOG";
    private static final String RAW="PRIVATE_PROVIDER_BODY_COOKIE_DO_NOT_LOG";
    private static class Logs implements AutoCloseable {
        final Logger logger=(Logger)LoggerFactory.getLogger(WalkingRoutingService.class);
        final ListAppender<ILoggingEvent> appender=new ListAppender<>();
        Logs(){appender.start();logger.addAppender(appender);}
        void verify(Route route,String category,Integer status){
            assertEquals("UNAVAILABLE",route.status());assertTrue(route.coordinates().isEmpty());assertNull(route.distanceMeters());assertNull(route.durationSeconds());
            assertEquals(1,appender.list.size());var event=appender.list.get(0);String message=event.getFormattedMessage();
            assertTrue(message.contains("category="+category));assertTrue(message.contains("http_status="+(status==null?"unavailable":status)));assertTrue(message.contains("elapsed_ms="));assertTrue(message.contains("request_id="));
            assertNull(event.getThrowableProxy());
            for(String secret:new String[]{KEY,RAW,"24.123456","46.654321","Authorization","Cookie","http://"}){assertFalse(message.contains(secret));assertFalse(route.message().contains(secret));}
            assertFalse(route.message().contains(category));if(status!=null)assertFalse(route.message().contains(status.toString()));
        }
        public void close(){logger.detachAppender(appender);appender.stop();}
    }
    private static HttpServer server(int status,String type,String body) throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/openrouteservice/v2/directions/foot-walking/geojson",exchange->{
            exchange.getRequestBody().readAllBytes();byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type",type);exchange.getResponseHeaders().add("Set-Cookie",RAW);
            exchange.sendResponseHeaders(status,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();return server;
    }
    private static Route route(String base){return new WalkingRoutingService(KEY,base).route(24.123456,46.654321,24.124456,46.655321);}
    private static String base(HttpServer s){return "http://127.0.0.1:"+s.getAddress().getPort()+"/openrouteservice";}
    @ParameterizedTest @CsvSource({"401,AUTHORIZATION","403,AUTHORIZATION","404,ENDPOINT_METHOD","405,ENDPOINT_METHOD","429,RATE_LIMIT","500,PROVIDER_5XX","502,PROVIDER_5XX","503,PROVIDER_5XX","504,PROVIDER_5XX","400,HTTP_OTHER","406,HTTP_OTHER"})
    void httpFailuresAreClassifiedWithoutLoggingProviderSecrets(int status,String category) throws Exception {
        var server=server(status,"application/json","{\"error\":\""+RAW+" "+KEY+" 24.123456 46.654321\"}");
        try(var logs=new Logs()){logs.verify(route(base(server)),category,status);}finally{server.stop(0);}
    }
    @ParameterizedTest @CsvSource({"application/geo+json,invalid-json","application/geo+json,empty-features","text/html,html","application/geo+json,invalid-geometry"})
    void invalidGeoJsonAndContentTypesAreParsingFailures(String type,String fixture) throws Exception {
        String body=switch(fixture){
            case "empty-features" -> "{\"type\":\"FeatureCollection\",\"features\":[]}";
            case "invalid-geometry" -> "{\"features\":[{\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[]}}]}";
            default -> RAW+" "+KEY+" 24.123456 46.654321";
        };
        var server=server(200,type,body);
        try(var logs=new Logs()){logs.verify(route(base(server)),"GEOJSON_PARSING",null);}finally{server.stop(0);}
    }
    @Test void connectionRefusalIsNetworkFailureWithoutLoggingTheUrl() throws Exception {
        int port;try(var socket=new ServerSocket(0)){port=socket.getLocalPort();}
        try(var logs=new Logs()){logs.verify(route("http://127.0.0.1:"+port+"/openrouteservice"),"NETWORK",null);}
    }
    @Test void actualReadTimeoutIsClassifiedAndRetainsTheBoundedTimeout() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);var executor=Executors.newCachedThreadPool();server.setExecutor(executor);
        server.createContext("/",exchange->{try{Thread.sleep(7000);}catch(InterruptedException e){Thread.currentThread().interrupt();}finally{exchange.close();}});server.start();
        long started=System.nanoTime();
        try(var logs=new Logs()){logs.verify(route(base(server)),"TIMEOUT",null);assertTrue((System.nanoTime()-started)/1_000_000<6500);}
        finally{server.stop(0);executor.shutdownNow();}
    }
}
