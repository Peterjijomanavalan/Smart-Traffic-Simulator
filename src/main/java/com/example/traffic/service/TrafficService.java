package com.example.traffic.service;

import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class TrafficService {

    public static class Road {
        public String id;
        public int vehicles;
        public int queue;
        public String light;
        public Road(String id){ this.id = id; this.vehicles = 0; this.queue = 0; this.light = "RED"; }
    }

    private final Map<String, Road> roads = new LinkedHashMap<>();
    private boolean running = false;
    private final List<SseEmitter> clients = new CopyOnWriteArrayList<>();
    private long cycles = 0;
    private Random rnd = new Random();

    public TrafficService(){
        roads.put("A", new Road("North Road"));
        roads.put("B", new Road("East Road"));
        roads.put("C", new Road("South Road"));
        roads.put("D", new Road("West Road"));
    }

    public Map<String, Road> snapshot(){
        Map<String, Road> snap = new LinkedHashMap<>();
        roads.forEach((k,v)->{
            Road r = new Road(v.id);
            r.vehicles = v.vehicles;
            r.queue = v.queue;
            r.light = v.light;
            snap.put(k,r);
        });
        return snap;
    }

    public synchronized void startSimulation(){ running = true; }
    public synchronized void stopSimulation(){ running = false; }
    public synchronized boolean isRunning(){ return running; }
    public synchronized long getCycles(){ return cycles; }

    public SseEmitter register(){
        SseEmitter emitter = new SseEmitter(0L);
        clients.add(emitter);
        emitter.onCompletion(()->clients.remove(emitter));
        emitter.onTimeout(()->clients.remove(emitter));
        return emitter;
    }

    @Scheduled(fixedRate = 1000)
    public void tick(){
        if(!running) return;
        cycles++;
        // arrivals
        roads.values().forEach(r -> {
            int arrivals = rnd.nextInt(4); // 0-3
            r.vehicles += arrivals;
            r.queue += arrivals;
        });
        // cycle lights: A->B->C->D each 4 ticks
        int period = (int)(cycles % 16);
        List<String> order = List.of("A","B","C","D");
        for(int i=0;i<4;i++){
            String key = order.get(i);
            roads.get(key).light = (period/4==i) ? "GREEN" : "RED";
        }
        // process vehicles on green
        roads.forEach((k,r)->{
            if("GREEN".equals(r.light)){
                int processed = Math.min(r.queue, 3);
                r.queue -= processed;
            }
        });
        // push SSE update
        Map<String,Object> payload = new LinkedHashMap<>();
        payload.put("time", Instant.now().toString());
        payload.put("cycles", cycles);
        payload.put("data", snapshot());
        for(SseEmitter e: clients){
            try{ e.send(SseEmitter.event().name("update").data(payload)); }
            catch(IOException ex){ clients.remove(e); }
        }
    }
}
