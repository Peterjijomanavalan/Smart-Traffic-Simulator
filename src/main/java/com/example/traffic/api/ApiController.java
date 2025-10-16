package com.example.traffic.api;

import com.example.traffic.service.TrafficService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    @Autowired
    private TrafficService trafficService;

    @GetMapping("/snapshot")
    public Map<String, ?> snapshot(){
        return trafficService.snapshot();
    }

    @PostMapping("/start")
    public String start(){
        trafficService.startSimulation();
        return "started";
    }
    @PostMapping("/stop")
    public String stop(){
        trafficService.stopSimulation();
        return "stopped";
    }

    @GetMapping("/sse")
    public SseEmitter sse(){
        return trafficService.register();
    }

    @GetMapping("/status")
    public Map<String,Object> status(){
        return Map.of("running", trafficService.isRunning(), "cycles", trafficService.getCycles());
    }
}
