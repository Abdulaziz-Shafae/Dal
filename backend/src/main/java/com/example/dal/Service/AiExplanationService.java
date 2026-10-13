package com.example.dal.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;
import java.util.*;

@Service
public class AiExplanationService {
    private final String apiKey, model;
    private final RestClient client;
    private long window;
    private int requests;
    @org.springframework.beans.factory.annotation.Autowired
    public AiExplanationService(@Value("${OPENAI_API_KEY:}") String apiKey,
                                @Value("${OPENAI_MODEL:gpt-4.1-mini}") String model) {
        this(apiKey, model, "https://api.openai.com");
    }
    AiExplanationService(String apiKey,String model,String baseUrl) {
        this.apiKey=apiKey; this.model=model;
        SimpleClientHttpRequestFactory factory=new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1500); factory.setReadTimeout(4500);
        client=RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    private synchronized boolean budget() {
        long now=System.currentTimeMillis()/60000;
        if (now!=window) {window=now;requests=0;}
        return requests++<10;
    }
    public Optional<String> explain(Map<String,Object> derivedFacts) {
        if (apiKey.isBlank() || !budget()) return Optional.empty();
        // Only server-derived distances, ages, counts and quality states: no coordinates, names or IDs.
        Map<String,Object> schema=Map.of("type","object","properties",Map.of("reason",Map.of("type","string")),"required",List.of("reason"),"additionalProperties",false);
        Map<String,Object> body=Map.of("model",model,"store",false,"max_output_tokens",400,
            "instructions","اكتب شرحًا عربيًا موجزًا للحقائق والتوصية المحسوبة فقط. لا تغيّر القرار، ولا تخترع معالم أو مواقع أو ازدحامًا أو ممرات آمنة أو وصولًا متاحًا. المسافة المباشرة ليست مسافة مشي. بيّن قدم البيانات وضعف دقتها وحدود الخرائط. لا تضف أرقامًا غير موجودة في المدخلات.",
            "input",JsonMapper.builder().build().writeValueAsString(derivedFacts),
            "text",Map.of("format",Map.of("type","json_schema","name","dal_explanation","strict",true,"schema",schema)));
        try {
            Map<?,?> response=client.post().uri("/v1/responses").header("Authorization","Bearer "+apiKey).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class);
            if (!"completed".equals(response.get("status"))) return Optional.empty();
            for(Object item:(List<?>)response.get("output")) {
                Map<?,?> output=(Map<?,?>)item;
                if (!"message".equals(output.get("type"))) continue;
                for(Object part:(List<?>)output.get("content")) {
                    Map<?,?> content=(Map<?,?>)part;
                    if (!"output_text".equals(content.get("type"))) continue;
                    String reason=JsonMapper.builder().build().readTree((String)content.get("text")).path("reason").asText();
                    if (!reason.isBlank()&&reason.length()<=1200&&!java.util.regex.Pattern.compile("الطريق آمن|المسار آمن|بدون زحام|لا يوجد ازدحام|المرور بأمان|طريق مشي آمن").matcher(reason).find()) return Optional.of(reason);
                }
            }
        } catch(RuntimeException e) { /* No provider response or request is logged. */ }
        return Optional.empty();
    }
}
