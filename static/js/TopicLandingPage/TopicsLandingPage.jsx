import React from 'react';
import {TopicLandingSearch} from "./TopicLandingSearch";
import {NavSidebar} from "../NavSidebar";
import Footer from "../Footer";
import {TopicSalad} from "./TopicSalad";
import {TopicLandingParasha} from "./TopicLandingParasha";
import {TopicLandingSeasonal} from "./TopicLandingSeasonal";
import {InterfaceText} from "../Misc";


export const TopicsLandingPage = ({openTopic}) => {
    const sidebarModules = [
    ];
    return (
        <div className="readerNavMenu" key="0">
            <div className="content">
                <div className="sidebarLayout">
                    <div className="contentInner mainColumn topic-landing-page-content">
                        <h1 className="topic-landing-header">
                            <InterfaceText>Let Your Curiosity Lead The Way</InterfaceText>
                        </h1>
                        <div className="topic-landing-section">
                            <TopicLandingSearch openTopic={openTopic} numOfTopics={5000}/>
                        </div>
                        <div className="topic-landing-section">
                            <TopicSalad/>
                        </div>
                        <div className="topic-landing-section topic-landing-temporal">
                            <TopicLandingParasha/>
                            <TopicLandingSeasonal/>
                        </div>
                    </div>
                    <NavSidebar sidebarModules={sidebarModules} />
                </div>
                <Footer />
            </div>
        </div>
    )
};
