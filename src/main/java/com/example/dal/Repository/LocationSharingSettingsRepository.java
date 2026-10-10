package com.example.dal.Repository;

import com.example.dal.Model.LocationSharingSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LocationSharingSettingsRepository extends JpaRepository<LocationSharingSettings, Integer> {

    LocationSharingSettings findLocationSharingSettingsById(Integer id);

    LocationSharingSettings findByUser_Id(Integer userId);
}
