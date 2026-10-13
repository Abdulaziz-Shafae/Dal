package com.example.dal;

import org.springframework.boot.test.context.SpringBootTest;
import java.lang.annotation.*;

/** Test properties outrank environment settings, preventing access to production DBs or providers. */
@Target(ElementType.TYPE) @Retention(RetentionPolicy.RUNTIME) @Inherited
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:dal_test;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "OPENAI_API_KEY=", "OPENROUTESERVICE_API_KEY=", "brevo.api-key="
})
public @interface IsolatedDalContext {}
