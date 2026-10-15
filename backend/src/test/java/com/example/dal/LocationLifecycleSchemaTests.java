package com.example.dal;

import com.example.dal.DtoIn.*;
import com.example.dal.Service.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import java.sql.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Only a unique in-memory H2 database. No environment datasource is consulted. */
class LocationLifecycleSchemaTests {
    private ConfigurableApplicationContext start(String url, String ddl) {
        Map<String,Object> properties=new HashMap<>();
        properties.put("spring.datasource.url",url); properties.put("spring.datasource.username","sa"); properties.put("spring.datasource.password",""); properties.put("spring.datasource.driver-class-name","org.h2.Driver");
        properties.put("spring.jpa.hibernate.ddl-auto",ddl); properties.put("spring.jpa.open-in-view",false); properties.put("spring.jpa.properties.hibernate.jdbc.time_zone","UTC");
        properties.put("BREVO_API_KEY",""); properties.put("OPENAI_API_KEY",""); properties.put("OPENROUTESERVICE_API_KEY","");
        return new SpringApplicationBuilder(DalApplication.class).web(WebApplicationType.SERVLET).properties("server.port=0")
                .initializers(context->context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-lifecycle-schema",properties))).run();
    }
    @Test void hibernateUpdateAddsNullableColumnsWithoutDeletingHistoricalDataAndLegacyLocationsFailClosed() throws Exception {
        String url="jdbc:h2:mem:lifecycle_"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1";
        int userId;
        try(var context=start(url,"create")) {
            var user=context.getBean(UserService.class).registerUser(new RegisterUserDtoIn("Synthetic legacy",UUID.randomUUID()+"@example.invalid","ValidPass1!")); userId=user.getId();
            context.getBean(UserLocationService.class).updateUserLocation(userId,new LocationDtoIn(24.0,46.0,5.0,OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(1)));
            assertNotNull(context.getBean(UserLocationService.class).getMyLatestLocation(userId).getLatitude());
        }
        try(var connection=DriverManager.getConnection(url,"sa","");var statement=connection.createStatement()) {
            statement.execute("ALTER TABLE user_locations DROP COLUMN activity_at");
            statement.execute("ALTER TABLE location_sharing_settings DROP COLUMN locations_valid_from");
            statement.execute("ALTER TABLE group_members DROP COLUMN locations_valid_from");
        }
        try(var context=start(url,"update")) {
            assertNull(context.getBean(UserLocationService.class).getMyLatestLocation(userId).getLatitude());
            try(var connection=DriverManager.getConnection(url,"sa","");var statement=connection.createStatement();var result=statement.executeQuery("SELECT latitude, recorded_at, activity_at FROM user_locations")) {
                assertTrue(result.next()); assertEquals(24.0,result.getDouble(1)); assertNotNull(result.getTimestamp(2)); assertNull(result.getTimestamp(3)); assertFalse(result.next());
            }
        } finally { try(var connection=DriverManager.getConnection(url,"sa","");var statement=connection.createStatement()) { statement.execute("DROP ALL OBJECTS"); } }
    }
}
