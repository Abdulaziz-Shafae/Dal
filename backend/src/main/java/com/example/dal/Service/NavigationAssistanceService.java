package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.NavigationRequest.*;
import com.example.dal.DtoOut.NavigationResult.*;
import com.example.dal.DtoOut.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class NavigationAssistanceService {
    private final GroupAccessService access;
    private final UserLocationService locations;
    private final MeetingPointService meetings;
    private final WalkingRoutingService routing;
    private final AiExplanationService ai;
    private final com.example.dal.Repository.MeetingPointRepository meetingRepository;
    private record Snapshot(UserLocationDtoOut own, UserLocationDtoOut member, MeetingPointDtoOut meeting) {}
    private Snapshot snapshot(Integer userId,Integer groupId,Destination destination) {
        access.requireMember(userId,groupId);
        if (destination==null || destination.meetingPoint()==(destination.memberId()!=null)) throw new ApiException("اختر عضوًا أو نقطة لقاء واحدة.");
        List<UserLocationDtoOut> rows=locations.getGroupLocations(userId,groupId);
        UserLocationDtoOut own=rows.stream().filter(p->userId.equals(p.getUserId())).findFirst().orElse(null);
        if (destination.meetingPoint()) return new Snapshot(own,null,meetings.getGroupMeetingPoint(userId,groupId));
        access.requireMember(destination.memberId(),groupId);
        return new Snapshot(own,rows.stream().filter(p->destination.memberId().equals(p.getUserId())).findFirst().orElse(null),null);
    }
    private static boolean allowed(UserLocationDtoOut p) {return p!=null&&Boolean.TRUE.equals(p.getSharingEnabled())&&p.getLatitude()!=null&&p.getLongitude()!=null&&WalkingRoutingService.valid(p.getLatitude(),p.getLongitude());}
    static long age(UserLocationDtoOut p) {return p==null||p.getRecordedAt()==null?Long.MAX_VALUE:Math.max(0,Duration.between(p.getRecordedAt().toInstant(),Instant.now()).getSeconds());}
    static double distance(double lat,double lon,double toLat,double toLon) {
        double a=Math.pow(Math.sin(Math.toRadians(toLat-lat)/2),2)+Math.cos(Math.toRadians(lat))*Math.cos(Math.toRadians(toLat))*Math.pow(Math.sin(Math.toRadians(toLon-lon)/2),2);
        return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
    }
    private Route route(Snapshot s) {
        if (!allowed(s.own())||age(s.own())>60) return Route.blocked("فعّل الملاحة وانتظر موقع GPS حديثًا ومسموحًا قبل حساب الطريق.");
        if (s.meeting()==null&&(!allowed(s.member())||age(s.member())>=300)) return Route.blocked("موقع العضو غير متاح أو مشاركته متوقفة أو قديم جدًا.");
        double lat=s.meeting()!=null?s.meeting().getLatitude():s.member().getLatitude(), lon=s.meeting()!=null?s.meeting().getLongitude():s.member().getLongitude();
        Route r=routing.route(s.own().getLatitude(),s.own().getLongitude(),lat,lon);
        return new Route(r.status(),r.coordinates(),r.distanceMeters(),r.durationSeconds(),r.message(),s.member()!=null&&age(s.member())>30);
    }
    public Route walking(Integer userId,Integer groupId,Destination destination) {
        Snapshot before=snapshot(userId,groupId,destination);
        Route result=route(before);
        // Recheck access/sharing after the external call, including cache hits.
        Snapshot after=snapshot(userId,groupId,destination);
        if (!allowed(after.own())||age(after.own())>60||(after.member()!=null&&(!allowed(after.member())||age(after.member())>=300))) return Route.blocked("توقفت مشاركة الموقع أو أصبحت قديمة؛ أُلغي المسار.");
        if (after.member()!=null&&!Objects.equals(before.member().getRecordedAt(),after.member().getRecordedAt())) return Route.unavailable("تغيّر موقع الوجهة أثناء الحساب. أعد المحاولة.");
        if (after.meeting()!=null&&!Objects.equals(before.meeting().getUpdatedAt(),after.meeting().getUpdatedAt())) return Route.unavailable("تغيّرت نقطة اللقاء أثناء الحساب. أعد المحاولة.");
        return result;
    }
    public Advice reunion(Integer userId,Integer groupId,Destination destination) {
        Snapshot s=snapshot(userId,groupId,destination);
        boolean available=s.meeting()!=null||allowed(s.member());
        long seconds=s.member()!=null?age(s.member()):0;
        String status=!available?"UNAVAILABLE":seconds>30?"STALE":"RECENT";
        boolean low=(s.own()!=null&&(s.own().getAccuracy()==null||s.own().getAccuracy()>50))||(s.member()!=null&&(s.member().getAccuracy()==null||s.member().getAccuracy()>50));
        String action=!available||seconds>30?"CONTACT_MEMBER":"FOLLOW_ROUTE";
        String recommendation=!available?"موقع العضو غير متاح. تواصل معه أو استخدم نقطة اللقاء المتفق عليها.":seconds>30?"هذا آخر موقع معروف فقط؛ قد يكون العضو تحرك. تواصل معه قبل الاعتماد عليه.":"استخدم طريق المشي المحسوب إن توفر، أو البوصلة باتجاه الوجهة مع مراعاة حدود الخرائط.";
        if (available && (!allowed(s.own())||age(s.own())>60)) { action="ACTIVATE_NAVIGATION"; recommendation="فعّل الملاحة وانتظر موقع GPS حديثًا ومسموحًا قبل التوجيه. يمكنك التواصل مع العضو أو الاتفاق على نقطة اللقاء."; }
        Double direct=allowed(s.own())&&available?distance(s.own().getLatitude(),s.own().getLongitude(),s.meeting()!=null?s.meeting().getLatitude():s.member().getLatitude(),s.meeting()!=null?s.meeting().getLongitude():s.member().getLongitude()):null;
        // AI consumes a recently computed walking route; asking AI never silently sends coordinates to ORS.
        Route route=Route.unavailable("لا يوجد طريق مشي محسوب حديثًا.");
        if(available&&allowed(s.own())&&age(s.own())<=60&&(s.member()==null||age(s.member())<300)) route=routing.cachedRoute(s.own().getLatitude(),s.own().getLongitude(),s.meeting()!=null?s.meeting().getLatitude():s.member().getLatitude(),s.meeting()!=null?s.meeting().getLongitude():s.member().getLongitude()).orElse(route);
        Map<String,Object> facts=new LinkedHashMap<>();
        facts.put("locationStatus",status); facts.put("ageSeconds",seconds==Long.MAX_VALUE?null:seconds); facts.put("lowAccuracy",low); facts.put("directDistanceMeters",direct); facts.put("walkingDistanceMeters",route.distanceMeters()); facts.put("recommendation",recommendation); facts.put("action",action);
        facts.put("ownAccuracyMeters",s.own()==null?null:s.own().getAccuracy()); facts.put("targetAccuracyMeters",s.member()==null?null:s.member().getAccuracy());
        facts.put("connectionStatus","BACKEND_REACHABLE"); facts.put("meetingPointAvailable",meetingRepository.findByGroup_Id(groupId)!=null);
        Optional<String> explanation=ai.explain(facts);
        Snapshot after=snapshot(userId,groupId,destination);
        if (available && s.member()!=null && (!allowed(after.member())||!Objects.equals(s.member().getRecordedAt(),after.member().getRecordedAt()))) throw new ApiException("تغيّرت بيانات العضو أو صلاحيات المشاركة؛ أعد طلب المساعدة.");
        return new Advice(explanation.isPresent()?"OPENAI":"RULES",status,recommendation,explanation.orElse("تقييم حسابي: نعتمد على حداثة الموقع ودقته ومسافة الطريق المحسوب فقط. خدمة AI غير متاحة حاليًا."),action,low,seconds==Long.MAX_VALUE?null:seconds,direct,route.distanceMeters(),low?"دقة GPS منخفضة أو غير معروفة؛ المسافات والاتجاه تقريبيان.":"الشرح لا يثبت سلامة الطريق أو الزحام، وخرائط الخارج قد لا تشمل ممرات إكسبو.");
    }
    public MeetingAdvice suggest(Integer userId,Integer groupId,Candidates input) {
        access.requireManager(userId,groupId); access.requireOpenGroup(access.requireGroup(groupId));
        List<UserLocationDtoOut> all=locations.getGroupLocations(userId,groupId);
        List<UserLocationDtoOut> usable=all.stream().filter(p->allowed(p)&&age(p)<=120&&p.getAccuracy()!=null&&p.getAccuracy()<=50).toList();
        if(usable.size()<2) return new MeetingAdvice("RULES","DIRECT",List.of(),"نحتاج موقعين مسموحين حديثين بدقة 50 مترًا أو أفضل. حدد نقاطًا موثوقة على الخريطة.",usable.size(),all.size()-usable.size(),"لا توجد توصية ممكنة بالبيانات الحالية.");
        List<RankedCandidate> ranking=new ArrayList<>();
        for(int i=0;i<input.candidates().size();i++) {
            Candidate c=input.candidates().get(i);
            if(!WalkingRoutingService.valid(c.latitude(),c.longitude())) throw new ApiException("إحداثيات المرشح غير صالحة.");
            double max=usable.stream().mapToDouble(p->distance(p.getLatitude(),p.getLongitude(),c.latitude(),c.longitude())).max().orElseThrow();
            ranking.add(new RankedCandidate(i,c.name().trim(),c.latitude(),c.longitude(),max));
        }
        ranking.sort(Comparator.comparingDouble(RankedCandidate::maximumDistanceMeters).thenComparingInt(RankedCandidate::index));
        Map<String,Object> facts=new LinkedHashMap<>(Map.of("criterion","minimize maximum direct distance among explicit candidates only; not walking distance","maximumDistancesMeters",ranking.stream().map(RankedCandidate::maximumDistanceMeters).toList(),"includedMembers",usable.size(),"excludedMembers",all.size()-usable.size()));
        var currentMeeting=meetingRepository.findByGroup_Id(groupId);
        facts.put("currentMeetingPointAvailable",currentMeeting!=null);
        if(currentMeeting!=null) facts.put("currentMeetingMaximumDirectDistanceMeters",usable.stream().mapToDouble(p->distance(p.getLatitude(),p.getLongitude(),currentMeeting.getLatitude(),currentMeeting.getLongitude())).max().orElseThrow());
        Optional<String> explanation=ai.explain(facts);
        access.requireManager(userId,groupId);
        List<UserLocationDtoOut> fresh=locations.getGroupLocations(userId,groupId);
        if (usable.stream().anyMatch(before->fresh.stream().noneMatch(after->before.getUserId().equals(after.getUserId())&&allowed(after)&&age(after)<=120&&Objects.equals(before.getRecordedAt(),after.getRecordedAt())))) throw new ApiException("تغيّرت مواقع الأعضاء أو صلاحيات المشاركة؛ أعد المقارنة.");
        return new MeetingAdvice(explanation.isPresent()?"OPENAI":"RULES","DIRECT",ranking,explanation.orElse("تقييم حسابي غير مولّد بواسطة AI: نختار أقل أكبر مسافة مباشرة بين المرشحين الذين حددهم المسؤول."),usable.size(),all.size()-usable.size(),"المسافات مباشرة وليست طرق مشي. تحقق بنفسك من صلاحية المكان والوصول؛ لا تُحفظ النقطة إلا بعد موافقتك.");
    }
}
