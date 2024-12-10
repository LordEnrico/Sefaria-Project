import React from 'react';
import {TopicLandingCalendar} from "./TopicLandingCalendar";
import {useState, useEffect} from "react";
import Sefaria from "../sefaria/sefaria";


export const TopicLandingSeasonal = () => {
    const [seasonal, setSeasonal] = useState({});

    useEffect(() => {
        Sefaria.getSeasonalTopic().then(setSeasonal);
    }, []);
    const title = seasonal.topic?.primaryTitle;
    const description = seasonal.topic?.description
    const link = `/topics/${seasonal.slug}`


    return (
        <div className='topic-landing-seasonal'>
        <TopicLandingCalendar
            header={{en: "Upcoming Holiday"}}
            title={title}
            description={description}
            link={link}
        />
        </div>
    );
};