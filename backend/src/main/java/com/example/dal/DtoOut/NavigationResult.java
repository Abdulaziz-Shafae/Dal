package com.example.dal.DtoOut;

import java.util.List;

public final class NavigationResult {
    private NavigationResult() {}
    public record Route(String status, List<List<Double>> coordinates, Double distanceMeters,
                        Double durationSeconds, String message, boolean lastKnownLocation) {
        public static Route unavailable(String message) { return new Route("UNAVAILABLE", List.of(), null, null, message, false); }
        public static Route blocked(String message) { return new Route("LOCATION_UNAVAILABLE", List.of(), null, null, message, false); }
    }
    public record Advice(String source, String locationStatus, String recommendation, String reason,
                         String action, boolean lowAccuracy, Long ageSeconds, Double directDistanceMeters,
                         Double walkingDistanceMeters, String warning) {}
    public record RankedCandidate(int index, String name, double latitude, double longitude, double maximumDistanceMeters) {}
    public record MeetingAdvice(String source, String metric, List<RankedCandidate> ranking,
                                String reason, int includedMembers, int excludedMembers, String warning) {}
}
