package com.example.dal;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.*;
import com.example.dal.Service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.sql.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in test: a freshly provisioned, loopback-only MySQL instance, never an environment datasource. */
@EnabledIfEnvironmentVariable(named="DAL_RUN_MYSQL_QA", matches="true")
class MySqlMigrationCompatibilityTests {
    private static final String DATABASE="dal_migration_qa";
    private static final String URL="jdbc:mysql://127.0.0.1:33307/"+DATABASE+"?sslMode=DISABLED&allowPublicKeyRetrieval=true&connectionTimeZone=UTC";
    private String password() {String value=System.getenv("DAL_MYSQL_QA_PASSWORD");assertNotNull(value,"Provision the disposable MySQL instance first");assertFalse(value.isBlank());return value;}
    private Connection connection() throws SQLException {
        Connection c=DriverManager.getConnection(URL,"dal_mysql_qa",password());
        assertEquals("MySQL",c.getMetaData().getDatabaseProductName());
        assertFalse(c.getMetaData().getDatabaseProductVersion().contains("MariaDB"));
        try(Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT DATABASE(),@@port")) {assertTrue(r.next());assertEquals(DATABASE,r.getString(1));assertEquals(33307,r.getInt(2));}
        return c;
    }
    private ConfigurableApplicationContext start(String ddl) {
        Map<String,Object> properties=new LinkedHashMap<>();
        properties.put("spring.datasource.url",URL);properties.put("spring.datasource.username","dal_mysql_qa");properties.put("spring.datasource.password",password());properties.put("spring.datasource.driver-class-name","com.mysql.cj.jdbc.Driver");
        properties.put("spring.jpa.hibernate.ddl-auto",ddl);properties.put("spring.jpa.open-in-view",false);properties.put("spring.jpa.properties.hibernate.jdbc.time_zone","UTC");properties.put("spring.datasource.hikari.maximum-pool-size",2);
        properties.put("spring.sql.init.mode","never");properties.put("server.address","127.0.0.1");properties.put("server.port",0);properties.put("spring.main.register-shutdown-hook",false);
        properties.put("OPENAI_API_KEY","");properties.put("OPENROUTESERVICE_API_KEY","");properties.put("brevo.api-key","");
        return new SpringApplicationBuilder(DalApplication.class).web(WebApplicationType.SERVLET)
            .initializers(context->context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("isolated-mysql-qa",properties))).run();
    }
    private long count(String table) throws SQLException {
        assertTrue(table.matches("[a-z_]+"));
        try(Connection c=connection();Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT COUNT(*) FROM "+table)) {assertTrue(r.next());return r.getLong(1);}
    }
    private List<String> schema() throws SQLException {
        List<String> result=new ArrayList<>();
        String[] queries={
            "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COALESCE(COLUMN_DEFAULT,'<null>'),EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('group_messages','group_message_reads') ORDER BY TABLE_NAME,ORDINAL_POSITION",
            "SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('group_messages','group_message_reads') ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX",
            "SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('group_messages','group_message_reads') AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME"};
        try(Connection c=connection();Statement s=c.createStatement()) {
            for(String query:queries) try(ResultSet rows=s.executeQuery(query)) {while(rows.next()) {StringJoiner row=new StringJoiner("|");for(int i=1;i<=rows.getMetaData().getColumnCount();i++)row.add(String.valueOf(rows.getObject(i)));result.add(row.toString());}}
            for(String table:List.of("group_messages","group_message_reads")) try(ResultSet rows=s.executeQuery("SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='"+table+"' AND REFERENCED_TABLE_NAME IS NOT NULL")) {assertTrue(rows.next());assertEquals(2,rows.getInt(1),"Foreign keys must not be duplicated by update");}
        }
        return result;
    }
    private void removeOnlyDisposableConversationTables() throws SQLException {
        try(Connection c=connection();Statement s=c.createStatement()) {s.execute("DROP TABLE group_message_reads");s.execute("DROP TABLE group_messages");}
    }
    private record Fixtures(UserDtoOut owner,UserDtoOut second,UserDtoOut third,UserDtoOut outsider,GroupDtoOut group) {}
    private Fixtures fixtures(ConfigurableApplicationContext context) {
        UserService users=context.getBean(UserService.class);GroupService groups=context.getBean(GroupService.class);
        List<UserDtoOut> people=new ArrayList<>();
        for(String name:List.of("MySQL owner","MySQL second","MySQL third","MySQL outsider"))people.add(users.registerUser(new RegisterUserDtoIn(name,UUID.randomUUID()+"@example.invalid","ValidPass1!")));
        GroupDtoOut group=groups.createGroup(people.get(0).getId(),new GroupDtoIn("Disposable MySQL fixture","DIRECT"));
        for(UserDtoOut member:people.subList(1,3))groups.joinGroup(member.getId(),new JoinGroupDtoIn(group.getJoinCode()));
        context.getBean(MessageService.class).sendMessage(people.get(0).getId(),group.getId(),people.get(1).getId(),new SendMessageDtoIn("رسالة خاصة قبل Migration",UUID.randomUUID().toString()));
        context.getBean(MeetingPointService.class).setMeetingPoint(people.get(0).getId(),group.getId(),new MeetingPointDtoIn("Synthetic meeting",24.7136,46.6753));
        context.getBean(UserLocationService.class).updateUserLocation(people.get(0).getId(),new LocationDtoIn(24.7136,46.6753,8.0,OffsetDateTime.now(ZoneOffset.UTC)));
        return new Fixtures(people.get(0),people.get(1),people.get(2),people.get(3),group);
    }
    private Integer exerciseJpa(ConfigurableApplicationContext context,Fixtures f) throws SQLException {
        GroupMessageService chats=context.getBean(GroupMessageService.class);
        SendMessageDtoIn input=new SendMessageDtoIn("رسالة MySQL للمجموعة",UUID.randomUUID().toString());
        var sent=chats.send(f.owner().getId(),f.group().getId(),input);
        assertEquals(sent.id(),chats.send(f.owner().getId(),f.group().getId(),input).id());
        for(UserDtoOut user:List.of(f.owner(),f.second(),f.third())) {var message=chats.conversation(user.getId(),f.group().getId(),0,20).getContent().get(0);assertEquals(input.getContent(),message.content());assertEquals(f.owner().getName(),message.senderName());assertNotNull(message.createdAt());}
        assertEquals(1,chats.unread(f.second().getId(),f.group().getId()));
        chats.read(f.second().getId(),f.group().getId(),sent.id());chats.read(f.second().getId(),f.group().getId(),sent.id());assertEquals(0,chats.unread(f.second().getId(),f.group().getId()));assertEquals(1,chats.unread(f.third().getId(),f.group().getId()));
        assertThrows(ApiException.class,()->chats.conversation(f.outsider().getId(),f.group().getId(),0,20));
        assertThrows(ApiException.class,()->chats.send(f.outsider().getId(),f.group().getId(),input));
        assertNull(context.getBean(MessageService.class).getConversation(f.second().getId(),f.group().getId(),f.owner().getId(),0,20).getContent().get(0).getReadAt());
        assertEquals("Synthetic meeting",context.getBean(MeetingPointService.class).getGroupMeetingPoint(f.owner().getId(),f.group().getId()).getName());
        assertEquals(24.7136,context.getBean(UserLocationService.class).getMyLatestLocation(f.owner().getId()).getLatitude(),0.0000001);
        // Test physical MySQL constraints, independently of service-level deduplication.
        try(Connection c=connection();PreparedStatement insert=c.prepareStatement("INSERT INTO group_messages(group_id,sender_id,content,client_message_id,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP(6))")) {
            insert.setInt(1,f.group().getId());insert.setInt(2,f.owner().getId());insert.setString(3,"duplicate");insert.setString(4,input.getClientMessageId());
            assertEquals(1062,assertThrows(SQLIntegrityConstraintViolationException.class,insert::executeUpdate).getErrorCode());
            insert.setInt(1,999999);insert.setString(4,UUID.randomUUID().toString());assertEquals(1452,assertThrows(SQLIntegrityConstraintViolationException.class,insert::executeUpdate).getErrorCode());
        }
        try(Connection c=connection();PreparedStatement insert=c.prepareStatement("INSERT INTO group_message_reads(group_id,user_id,last_message_id) VALUES(?,?,0)")) {
            insert.setInt(1,f.group().getId());insert.setInt(2,f.second().getId());assertEquals(1062,assertThrows(SQLIntegrityConstraintViolationException.class,insert::executeUpdate).getErrorCode());
            insert.setInt(2,999999);assertEquals(1452,assertThrows(SQLIntegrityConstraintViolationException.class,insert::executeUpdate).getErrorCode());
        }
        assertEquals(1,count("group_messages"));assertEquals(1,count("group_message_reads"));return sent.id();
    }
    @Test void manualMigrationAndHibernateUpdateBothWorkWithoutDuplicateTablesOrLostData() throws Exception {
        try(Connection c=connection()) {System.out.println("MYSQL_QA_VERSION="+c.getMetaData().getDatabaseProductVersion());}
        assertEquals(0,countExistingTables());
        Fixtures f;
        try(var baseline=start("update")) {f=fixtures(baseline);}
        // Reconstruct the old schema: the two newly introduced tables are still empty.
        assertEquals(0,count("group_messages"));assertEquals(0,count("group_message_reads"));removeOnlyDisposableConversationTables();
        Map<String,Long> before=new LinkedHashMap<>();for(String table:List.of("users","dal_groups","messages","meeting_points","user_locations"))before.put(table,count(table));
        try(Connection c=connection()) {ScriptUtils.executeSqlScript(c,new FileSystemResource("migrations/20261013_group_conversation.sql"));}
        List<String> migrated=schema();Integer messageId;
        try(var update=start("update")) {
            assertEquals(migrated,schema(),"Hibernate update must preserve migration columns, indexes and foreign keys");
            for(var entry:before.entrySet())assertEquals(entry.getValue().longValue(),count(entry.getKey()));
            messageId=exerciseJpa(update,f);
        }
        try(var restart=start("update")) {
            assertEquals(migrated,schema());assertEquals(1,count("group_messages"));assertEquals(1,count("group_message_reads"));
            assertEquals(messageId,restart.getBean(GroupMessageService.class).conversation(f.owner().getId(),f.group().getId(),0,20).getContent().get(0).id());
            assertEquals(0,restart.getBean(GroupMessageService.class).unread(f.second().getId(),f.group().getId()));
        }
        try(var validate=start("validate")) {assertEquals(migrated,schema());}
        // Alternative supported path: SQL is not executed; update alone creates both absent tables.
        removeOnlyDisposableConversationTables();
        List<String> automatic;
        try(var update=start("update")) {automatic=schema();exerciseJpa(update,f);}
        try(var restart=start("update")) {assertEquals(automatic,schema());assertEquals(1,count("group_messages"));assertEquals(1,count("group_message_reads"));}
        try(var validate=start("validate")) {assertEquals(automatic,schema());}
        System.out.println("MYSQL_MIGRATION_QA=PASS manual_then_update=PASS update_only=PASS restart_preserves_data=PASS validate=PASS unique_and_foreign_keys=PASS");
    }
    private long countExistingTables() throws SQLException {
        try(Connection c=connection();Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()")) {assertTrue(r.next());return r.getLong(1);}
    }
}
