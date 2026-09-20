package com.aiemailassistant.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Health-check controller.
 * Returns a simple JSON response to confirm the backend is running.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> body = Map.of(
                "status", "ok",
                "service", "backend",
                "timestamp", Instant.now().toString()
        );
        return ResponseEntity.ok(body);
    }
}
