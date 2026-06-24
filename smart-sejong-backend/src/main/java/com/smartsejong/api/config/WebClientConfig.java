package com.smartsejong.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient sejongWebClient() {
        return WebClient.builder()
                .baseUrl("https://portal.sejong.ac.kr")
                .build();
    }

    @Bean
    public WebClient aiWebClient(@Value("${ai.fastapi.base-url:}") String baseUrl) {
        return WebClient.builder()
                .baseUrl(baseUrl.replaceAll("/+$", ""))
                .build();
    }
}
