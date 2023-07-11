//const React      = require('react');
import React, { useState, useEffect, useContext, useRef } from 'react';
import ReactDOM  from 'react-dom';
import $  from './sefaria/sefariaJquery';
import { CollectionsModal } from "./CollectionsWidget";
import Sefaria  from './sefaria/sefaria';
import classNames  from 'classnames';
import PropTypes  from 'prop-types';
import Component from 'react-class';
import { usePaginatedDisplay } from './Hooks';
import {ContentLanguageContext, AdContext, StrapiDataContext} from './context';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {Editor} from "slate";
import ReactTags from "react-tag-autocomplete";
import {AdminEditorButton, useEditToggle} from "./AdminEditor";
import {CategoryEditor, ReorderEditor} from "./CategoryEditor";
import {refSort} from "./TopicPage";
import {TopicEditor} from "./TopicEditor";
import { SignUpModalKind, generateContentForModal } from './sefaria/signupModalContent';
import {SourceEditor} from "./SourceEditor";
import Cookies from "js-cookie";

/**
 * Component meant to simply denote a language specific string to go inside an InterfaceText element
 * ```
 * <InterfaceText>
 *     <EnglishText>lorem ipsum</EnglishText>
 *     <HebrewText>lorem ipsum</HebrewText>
 * </InterfaceText>
 * ```
 * @param children
 * @returns {JSX.Element}
 * @constructor
 */
const HebrewText = ({children}) => (
    <>{children}</>
);
const EnglishText = ({children}) => (
    <>{children}</>
);

const AvailableLanguages = () => {
  return {"english" : EnglishText, "hebrew": HebrewText};
};
const AvailableLanguagesValidator = (children, key, componentName, location, propFullName) => {
    if (!(children[key].type && (Object.values(AvailableLanguages()).indexOf(children[key].type) != -1) )) {
      return new Error(
        'Invalid prop `' + propFullName + '` supplied to' +
        ' `' + componentName + '`. Validation failed.'
      );
    }
};
const __filterChildrenByLanguage = (children, language) => {
  let chlArr = React.Children.toArray(children);
  let currLangComponent = AvailableLanguages()[language];
  let newChildren = chlArr.filter(x=> x.type == currLangComponent);
  return newChildren;
};

const InterfaceText = ({text, html, children, context}) => {
  /**
   * Renders a single span for interface string with either class `int-en`` or `int-he` depending on Sefaria.interfaceLang.
   *  If passed explicit text or html objects as props with "en" and/or "he", will only use those to determine correct text or fallback text to display.
   *  Otherwise:
   * `children` can be the English string, which will be translated with Sefaria._ if needed.
   * `children` can also take the form of <LangText> components above, so they can be used for longer paragrpahs or paragraphs containing html, if needed.
   * `context` is passed to Sefaria._ for additional translation context
   */
  const [contentVariable, isDangerouslySetInnerHTML]  = html ? [html, true] : [text, false];
  const isHebrew = Sefaria.interfaceLang === "hebrew";
  let elemclasses = classNames({"int-en": !isHebrew, "int-he": isHebrew});
  let textResponse = null;
  if (contentVariable) {// Prioritize explicit props passed in for text of the element, does not attempt to use Sefaria._() for this case
    let {he, en} = contentVariable;
    textResponse = isHebrew ? (he || en) : (en || he);
    let fallbackCls = (isHebrew && !he) ? " enInHe" : ((!isHebrew && !en) ? " heInEn" : "" );
    elemclasses += fallbackCls;
  } else { // Also handle composition with children
    const chlCount = React.Children.count(children);
    if (chlCount === 1) { // Same as passing in a `en` key but with children syntax
      textResponse = Sefaria._(children, context);
    } else if (chlCount <= Object.keys(AvailableLanguages()).length){ // When multiple languages are passed in via children
      let newChildren = __filterChildrenByLanguage(children, Sefaria.interfaceLang);
      textResponse = newChildren[0]; //assumes one language element per InterfaceText, may be too naive
    } else {
      console.log("Error too many children")
    }
  }
  return (
    isDangerouslySetInnerHTML ?
      <span className={elemclasses} dangerouslySetInnerHTML={{__html: textResponse}}/>
      :
      <span className={elemclasses}>{textResponse}</span>
  );
};
InterfaceText.propTypes = {
  //Makes sure that children passed in are either a single string, or an array consisting only of <EnglishText>, <HebrewText>
  children: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(AvailableLanguagesValidator),
  ]),
  content: PropTypes.object,
  html: PropTypes.object,
  context: PropTypes.string,
  className: PropTypes.string
};

const ContentText = ({text, html, overrideLanguage, defaultToInterfaceOnBilingual=false, bilingualOrder = null}) => {
  /**
   * Renders content language throughout the site (content that comes from the database and is not interface language)
   * Gets the active content language from Context and renders only the appropriate child(ren) for given language
   * text {{text: object}} a dictionary {en: "some text", he: "some translated text"} to use for each language
   * html {{html: object}} a dictionary {en: "some html", he: "some translated html"} to use for each language in the case where it needs to be dangerously set html
   * overrideLanguage a string with the language name (full not 2 letter) to force to render to overriding what the content language context says. Can be useful if calling object determines one langugae is missing in a dynamic way
   * defaultToInterfaceOnBilingual use if you want components not to render all languages in bilingual mode, and default them to what the interface language is
   * bilingualOrder is an array of short language notations (e.g. ["he", "en"]) meant to tell the component what
   * order to render the bilingual langauage elements in (as opposed to the unguaranteed order by default).
   */
  const [contentVariable, isDangerouslySetInnerHTML]  = html ? [html, true] : [text, false];
  const contentLanguage = useContext(ContentLanguageContext);
  const languageToFilter = (defaultToInterfaceOnBilingual && contentLanguage.language === "bilingual") ? Sefaria.interfaceLang : (overrideLanguage ? overrideLanguage : contentLanguage.language);
  const langShort = languageToFilter.slice(0,2);
  let renderedItems = Object.entries(contentVariable);
  if(languageToFilter === "bilingual"){
    if(bilingualOrder !== null){
      //nifty function that sorts one array according to the order of a second array.
      renderedItems.sort(function(a, b){
        return bilingualOrder.indexOf(a[0]) - bilingualOrder.indexOf(b[0]);
      });
    }
  }else{
    renderedItems = renderedItems.filter(([lang, _])=>{
      return lang === langShort;
    });
  }
  return renderedItems.map( x =>
      isDangerouslySetInnerHTML ?
          <span className={`contentSpan ${x[0]}`} lang={x[0]} key={x[0]} dangerouslySetInnerHTML={{__html: x[1]}}/>
          :
          <span className={`contentSpan ${x[0]}`} lang={x[0]} key={x[0]}>{x[1]}</span>
  );
};


const LoadingRing = () => (
  <div className="lds-ring"><div></div><div></div><div></div><div></div></div>
);

const DonateLink = ({children, classes, source, link}) => {
  link = link || "default";
  source = source || "undefined";
  const linkOptions = {
    default: {
      en: "https://donate.sefaria.org/en",
      he: "https://donate.sefaria.org/he"
    },
    sustainer: {
      en: "https://donate.sefaria.org/sustainers",
      he: "https://donate.sefaria.org/sustainershe"
    },
    dayOfLearning: {
      en: "https://donate.sefaria.org/sponsor",
      he: "https://donate.sefaria.org/sponsorhe",
    }
  };
  const url = `${Sefaria._v(linkOptions[link])}?c_src=${source}`;

  return (
    <a href={url} className={classes} target="_blank">
      {children}
    </a>
  );
};

/* flexible profile picture that overrides the default image of gravatar with text with the user's initials */
class ProfilePic extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showDefault: !this.props.url || this.props.url.startsWith("https://www.gravatar"), // We can't know in advance if a gravatar image exists of not, so start with the default beforing trying to load image
      src: null,
      isFirstCropChange: true,
      crop: {unit: "px", width: 250, aspect: 1},
      croppedImageBlob: null,
      error: null,
    };
    this.imgFile = React.createRef();
  }
  setShowDefault() { /* console.log("error"); */ this.setState({showDefault: true});  }
  setShowImage() { /* console.log("load"); */ this.setState({showDefault: false});  }
  componentDidMount() {
    if (this.didImageLoad()) {
      this.setShowImage();
    } else {
      this.setShowDefault();
    }
  }
  didImageLoad(){
    // When using React Hydrate, the onLoad event of the profile image will return before
    // react code runs, so we check after mount as well to look replace bad images, or to
    // swap in a gravatar image that we now know is valid.
    const img = this.imgFile.current;
    return (img && img.complete && img.naturalWidth !== 0);
  }
  onSelectFile(e) {
    if (e.target.files && e.target.files.length > 0) {
      if (!e.target.files[0].type.startsWith('image/')) {
        this.setState({ error: "Error: Please upload an image with the correct file extension (e.g. jpg, png)"});
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () =>
        this.setState({ src: reader.result })
      );
      console.log("FILE", e.target.files[0]);
      reader.readAsDataURL(e.target.files[0]);
    }
  }
  onImageLoaded(image) {
    this.imageRef = image;
  }
  onCropComplete(crop) {
    this.makeClientCrop(crop);
  }
  onCropChange(crop, percentCrop) {
    // You could also use percentCrop:
    // this.setState({ crop: percentCrop });
    if (this.state.isFirstCropChange) {
      const { clientWidth:width, clientHeight:height } = this.imageRef;
      crop.width = Math.min(width, height);
      crop.height = crop.width;
      crop.x = (this.imageRef.width/2) - (crop.width/2);
      crop.y = (this.imageRef.height/2) - (crop.width/2);
      this.setState({ crop, isFirstCropChange: false });
    } else {
      this.setState({ crop });
    }
  }
  async makeClientCrop(crop) {
    if (this.imageRef && crop.width && crop.height) {
      const croppedImageBlob = await this.getCroppedImg(
        this.imageRef,
        crop,
        "newFile.jpeg"
      );
      //console.log(croppedImageUrl);
      this.setState({ croppedImageBlob });
    }
  }
  getCroppedImg(image, crop, fileName) {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          console.error("Canvas is empty");
          return;
        }
        blob.name = fileName;
        resolve(blob);
      }, "image/jpeg");
    });
  }
  closePopup({ cb }) {
    this.setState({
      src: null,
      crop: {unit: "px", width: 250, aspect: 1},
      isFirstCropChange: true,
      croppedImageBlob: null,
      error: null,
    }, cb);
  }
  async upload() {
    const formData = new FormData();
    formData.append('file', this.state.croppedImageBlob);
    this.setState({ uploading: true });
    let errored = false;
    try {
      const response = await Sefaria.uploadProfilePhoto(formData);
      if (response.error) {
        throw new Error(response.error);
      } else {
        this.closePopup({ cb: () => {
          window.location = "/profile/" + Sefaria.slug; // reload to get update
          return;
        }});
      }
    } catch (e) {
      errored = true;
      console.log(e);
    }
    this.setState({ uploading: false, errored });
  }
  render() {
    const { name, url, len, hideOnDefault, showButtons, outerStyle } = this.props;
    const { showDefault, src, crop, error, uploading, isFirstCropChange } = this.state;
    const nameArray = !!name.trim() ? name.trim().split(/\s/) : [];
    const initials = nameArray.length > 0 ? (nameArray.length === 1 ? nameArray[0][0] : nameArray[0][0] + nameArray[nameArray.length-1][0]) : "";
    const defaultViz = showDefault ? 'flex' : 'none';
    const profileViz = showDefault ? 'none' : 'block';
    const imageSrc = url.replace("profile-default.png", 'profile-default-404.png');  // replace default with non-existant image to force onLoad to fail

    return (
      <div style={outerStyle} className="profile-pic">
        <div className={classNames({'default-profile-img': 1, noselect: 1, invisible: hideOnDefault})}
          style={{display: defaultViz,  width: len, height: len, fontSize: len/2}}>
          { showButtons ? null : `${initials}` }
        </div>
        <img
          className="img-circle profile-img"
          style={{display: profileViz, width: len, height: len, fontSize: len/2}}
          src={imageSrc}
          alt="User Profile Picture"
          ref={this.imgFile}
          onLoad={this.setShowImage}
          onError={this.setShowDefault}
        />
        {this.props.children ? this.props.children : null /*required for slate.js*/}
        { showButtons ? /* cant style file input directly. see: https://stackoverflow.com/questions/572768/styling-an-input-type-file-button */
            (<div className={classNames({"profile-pic-button-visible": showDefault !== null, "profile-pic-hover-button": !showDefault, "profile-pic-button": 1})}>
              <input type="file" className="profile-pic-input-file" id="profile-pic-input-file" onChange={this.onSelectFile} onClick={(event)=> { event.target.value = null}}/>
              <label htmlFor="profile-pic-input-file" className={classNames({resourcesLink: 1, blue: showDefault})}>
                <span className="int-en">{ showDefault ? "Add Picture" : "Upload New" }</span>
                <span className="int-he">{ showDefault ? "הוספת תמונה" : "עדכון תמונה" }</span>
              </label>
            </div>) : null
          }
          { (src || !!error) && (
            <div id="interruptingMessageBox" className="sefariaModalBox">
              <div id="interruptingMessageOverlay" onClick={this.closePopup}></div>
              <div id="interruptingMessage" className="profile-pic-cropper-modal">
                <div className="sefariaModalContent profile-pic-cropper-modal-inner">
                  { src ?
                    (<ReactCrop
                      src={src}
                      crop={crop}
                      className="profile-pic-cropper"
                      keepSelection
                      onImageLoaded={this.onImageLoaded}
                      onComplete={this.onCropComplete}
                      onChange={this.onCropChange}
                    />) : (<div className="profile-pic-cropper-error">{ error }</div>)
                  }
              </div>
              { (uploading || isFirstCropChange) ? (<div className="profile-pic-loading"><LoadingRing /></div>) : (
                <div>
                  <div className="smallText profile-pic-cropper-desc">
                    <span className="int-en">Drag corners to crop image</span>
                    <span className="int-he">לחיתוך התמונה, גרור את הפינות</span>
                  </div>
                  <div className="profile-pic-cropper-button-row">
                    <a href="#" className="resourcesLink profile-pic-cropper-button" onClick={this.closePopup}>
                      <span className="int-en">Cancel</span>
                      <span className="int-he">בטל</span>
                    </a>
                    <a href="#" className="resourcesLink blue profile-pic-cropper-button" onClick={this.upload}>
                      <span className="int-en">Save</span>
                      <span className="int-he">שמור</span>
                    </a>
                  </div>
                </div>
                )
              }
            </div>
          </div>
          )
        }
      </div>
    );
  }
}
ProfilePic.propTypes = {
  url:     PropTypes.string,
  name:    PropTypes.string,
  len:     PropTypes.number,
  hideOnDefault: PropTypes.bool,  // hide profile pic if you have are displaying default pic
  showButtons: PropTypes.bool,  // show profile pic action buttons
};


const FilterableList = ({
  filterFunc, sortFunc, renderItem, sortOptions, getData, data, renderEmptyList,
  renderHeader, renderFooter, showFilterHeader, refreshData, initialFilter,
  scrollableElement, pageSize, onDisplayedDataChange, initialRenderSize,
  bottomMargin, containerClass
}) => {
  const [filter, setFilter] = useState(initialFilter || '');
  const [sortOption, setSortOption] = useState(sortOptions[0]);
  const [displaySort, setDisplaySort] = useState(false);

  // Apply filter and sort to the raw data
  const processData = rawData => rawData ? rawData
      .filter(item => !filter ? true : filterFunc(filter, item))
      .sort((a, b) => sortFunc(sortOption, a, b))
      : [];

  const cachedData = data || null;
  const [loading, setLoading] = useState(!cachedData);
  const [rawData, setRawData] = useState(cachedData);
  const [displayData, setDisplayData] = useState(processData(rawData));

  // If `getData` function is passed, load data through this effect
  useEffect(() => {
    let isMounted = true;
    if (!rawData && !!getData) { // Don't try calling getData when `data` is intially passed
      setLoading(true);
      getData().then(data => {
        if (isMounted) {
          setRawData(data);
          setDisplayData(processData(data));
          setLoading(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [getData, rawData]);

  // Alternatively, if there is no `getData` function passed, we expect data
  // to be fed in directly through the `data` prop. Check `data` again whenever
  // refreshData signal changes.
  useEffect(() => {
    setRawData(data);
    setDisplayData(processData(data));
  }, [data, refreshData]);

  // Updates to filter or sort
  useEffect(() => {
    setDisplayData(processData(rawData));
  }, [filter, sortOption]);

  const dataUpToPage = usePaginatedDisplay(scrollableElement, displayData, pageSize, bottomMargin, initialRenderSize || pageSize);

  if (onDisplayedDataChange) {
    useEffect(() => {
      onDisplayedDataChange(dataUpToPage);
    }, [dataUpToPage]);
  }

  const onSortChange = newSortOption => {
    if (newSortOption === sortOption) { return; }
    setSortOption(newSortOption);
    setDisplaySort(false);
  };

  const oldDesign = typeof showFilterHeader == 'undefined';
  return (
    <div className="filterable-list">
      {oldDesign ? <div className="filter-bar">
        <div className="filter-bar-inner">
          <SearchButton />
          <input
            type="text"
            placeholder={Sefaria._("Search")}
            name="filterableListInput"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div>
          { sortOptions.length > 1 ?
            <DropdownModal close={()=>setDisplaySort(false)} isOpen={displaySort}>
              <DropdownButton
                isOpen={displaySort}
                toggle={()=>setDisplaySort(prev => !prev)}
                enText={"Sort"}
                heText={"מיון"}
              />
              <DropdownOptionList
                isOpen={displaySort}
                options={sortOptions.map(option => ({type: option, name: option, heName: Sefaria._(option, "FilterableList")}))}
                currOptionSelected={sortOption}
                handleClick={onSortChange}
              />
            </DropdownModal>
            : null
          }
        </div>
      </div> : null }
      { !oldDesign && showFilterHeader ? (
        <div className="filter-bar-new">
          <div className="filter-input">
            <SearchButton />
            <input
              type="text"
              placeholder={Sefaria._("Search")}
              name="filterableListInput"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="filter-sort-wrapper">
            <span className="systemText">
              <InterfaceText>Sort by</InterfaceText>
            </span>
            { sortOptions.map(option =>(
              <span
                key={option}
                className={classNames({'sans-serif': 1, 'sort-option': 1, noselect: 1, active: sortOption === option})}
                onClick={() => onSortChange(option)}
              >
                <InterfaceText context="FilterableList">{option}</InterfaceText>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {
        loading ? <LoadingMessage /> :
        <div className={"filter-content" + (containerClass ? " " + containerClass : "")}>
          {dataUpToPage.length ?
          <>
            { !!renderHeader ? renderHeader({filter}) : null }
            { dataUpToPage.map(renderItem) }
          </>
          : <>{!!renderEmptyList ? renderEmptyList({filter}) : null}</>}
          { !!renderFooter ? renderFooter({filter}) : null }
        </div>
      }
    </div>
  );
};
FilterableList.propTypes = {
  filterFunc:       PropTypes.func.isRequired,
  sortFunc:         PropTypes.func.isRequired,
  renderItem:       PropTypes.func.isRequired,
  sortOptions:      PropTypes.array.isRequired,
  getData:          PropTypes.func,   // At least one of `getData` or `data` is required
  data:             PropTypes.array,
  renderEmptyList:  PropTypes.func,
  renderHeader:     PropTypes.func,
  renderFooter:     PropTypes.func,
  showFilterHeader: PropTypes.bool,
};


class TabView extends Component {
  constructor(props) {
    super(props);
    const { currTabName } = props;
    this.state = {
      currTabName: typeof currTabName === 'undefined' ? this.props.tabs[0].id : currTabName
    };
  }
  componentDidMount() {
    if (this.props.currTabName === null) {
      this.props.setTab(this.props.tabs[0].id, true)
    }
  }
  openTab(index) {
    this.setState({currTabIndex: index});
  }
  getTabIndex() {
    let tabIndex;
    if (typeof this.props.currTabName === 'undefined') {
      tabIndex = this.props.tabs.findIndex(tab => tab.id === this.state.currTabName ? true : false)
    } else if (this.props.currTabName === null) {
      tabIndex = 0;
    } else {
      tabIndex = this.props.tabs.findIndex(tab => tab.id === this.props.currTabName ? true : false)
    }
    if(tabIndex === -1) {
      tabIndex = 0;
    }
    return tabIndex;
  }
  onClickTab(e, clickTabOverride) {
    if (clickTabOverride) {
      clickTabOverride()
    } else {
      let target = $(event.target);
      while (!target.attr("data-tab-index")) { target = target.parent(); }
      const tabIndex = parseInt(target.attr("data-tab-index"));
      const { onClickArray, setTab, tabs } = this.props;
      if (onClickArray && onClickArray[tabIndex]) {
        onClickArray[tabIndex]();
      } else {
        this.openTab(tabIndex);
        const tab = this.props.tabs[tabIndex];
        setTab && setTab(tab.id);
      }
    }
  }
  renderTab(tab, index) {
    const currTabIndex = this.getTabIndex();
    return (
      <div className={classNames({active: currTabIndex === index, justifyright: tab.justifyright})} key={tab.id} data-tab-index={index} onClick={(e) => {this.onClickTab(e, tab.clickTabOverride)}}>
        {this.props.renderTab(tab, index)}
      </div>
    );
  }
  render() {
    const currTabIndex = this.getTabIndex();
    const classes = classNames({"tab-view": 1, [this.props.containerClasses]: 1});
    return (
      <div className={classes}>
        <div className="tab-list sans-serif">
          {this.props.tabs.map(this.renderTab)}
        </div>
        { React.Children.toArray(this.props.children)[currTabIndex] }
      </div>
    );
  }
}
TabView.propTypes = {
  tabs:         PropTypes.array.isRequired,  // array of objects of any form. only requirement is each tab has a unique 'id' field. These objects will be passed to renderTab.
  renderTab:    PropTypes.func.isRequired,
  currTabName:  PropTypes.string,  // optional. If passed, TabView will be controlled from outside
  setTab:       PropTypes.func,    // optional. If passed, TabView will be controlled from outside
  onClickArray: PropTypes.object,  // optional. If passed, TabView will be controlled from outside
};


class DropdownOptionList extends Component {
  render() {
    return (
      <div className={(this.props.isOpen) ? "dropdown-option-list" :"dropdown-option-list hidden"}>
        <table>
          <tbody>
            {
              this.props.options.map( (option, iSortTypeObj) => {
                const tempClasses = classNames({'filter-title': 1, unselected: this.props.currOptionSelected !== option.type});
                return (
                  <tr key={option.type} className={tempClasses} onClick={()=>{ this.props.handleClick(option.type); }} tabIndex={`${iSortTypeObj}`} onKeyPress={e => {e.charCode == 13 ? this.props.handleClick(option.type) : null}} aria-label={`Sort by ${option.name}`}>
                    <td>
                      <img className="dropdown-option-check" src="/static/img/check-mark.svg" alt={`${option.name} sort selected`}/>
                    </td>
                    <td className="dropdown-option-list-label">
                      <span className="int-en">{option.name}</span>
                      <span className="int-he" dir="rtl">{option.heName}</span>
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    );
  }
}
DropdownOptionList.propTypes = {
  initialTabIndex: PropTypes.number,
  setTab: PropTypes.func,
  isOpen: PropTypes.bool.isRequired,
  options: PropTypes.array.isRequired,
  currOptionSelected: PropTypes.string.isRequired,
  handleClick: PropTypes.func.isRequired,
};


const DropdownButton = ({isOpen, toggle, enText, heText, buttonStyle}) => {
  const filterTextClasses = classNames({ "dropdown-button": 1, active: isOpen, buttonStyle });
  return (
    <div className={ filterTextClasses } tabIndex="0" onClick={toggle} onKeyPress={(e) => {e.charCode == 13 ? toggle(e):null}}>
      <InterfaceText text={{en: enText, he: heText}} />
      {isOpen ? <img src="/static/img/arrow-up.png" alt=""/> : <img src="/static/img/arrow-down.png" alt=""/>}
    </div>
  );
};
DropdownButton.propTypes = {
  isOpen:      PropTypes.bool.isRequired,
  toggle:      PropTypes.func.isRequired,
  enText:      PropTypes.string.isRequired,
  heText:      PropTypes.string.isRequired,
  buttonStyle: PropTypes.bool,
};


class DropdownModal extends Component {
  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside, false);
  }
  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside, false);
  }
  handleClickOutside(event) {
    const domNode = ReactDOM.findDOMNode(this);
    if ((!domNode || !domNode.contains(event.target)) && this.props.isOpen) {
      this.props.close();
    }
  }
  render() {
    return (
      <div className={classNames({"dropdown-modal": 1, "position-unset": this.props.positionUnset, "sans-serif": 1})}>
        { this.props.children }
      </div>
    );
  }
}
DropdownModal.propTypes = {
  close:   PropTypes.func.isRequired,
  isOpen:  PropTypes.bool.isRequired,
  positionUnset: PropTypes.bool,  // for search filters
};


class Link extends Component {
  handleClick(e) {
    e.preventDefault();
    this.props.onClick();
  }
  render() {
    return <a
              className={this.props.className}
              href={this.props.href}
              onClick={this.handleClick}
              title={this.props.title}>{this.props.children}</a>
  }
}
Link.propTypes = {
  href:    PropTypes.string.isRequired,
  onClick: PropTypes.func,
  title:   PropTypes.string.isRequired,
};


class GlobalWarningMessage extends Component {
  close() {
    Sefaria.globalWarningMessage = null;
    this.forceUpdate();
  }
  render() {
    return Sefaria.globalWarningMessage ?
      <div id="globalWarningMessage">
        <i className='close fa fa-times' onClick={this.close}></i>
        <div dangerouslySetInnerHTML={ {__html: Sefaria.globalWarningMessage} }></div>
      </div>
      : null;
  }
}


class TextBlockLink extends Component {
  // Monopoly card style link with category color at top
  // This component is seriously overloaded :grimacing:

  render() {
    let { book, category, title, heTitle, showSections, sref, heRef, displayValue, heDisplayValue, position, url_string, recentItem, currVersions, sideColor, saved, sheetTitle, sheetOwner, timeStamp, intlang } = this.props;
    const index    = Sefaria.index(book);
    category = category || (index ? index.primary_category : "Other");
    const style    = {"borderColor": Sefaria.palette.categoryColor(category)};
    title    = title   || (showSections ? sref : book);
    heTitle  = heTitle || (showSections ? heRef : index.heTitle);
    const hlang = intlang ? "int-he": "he";
    const elang = intlang ? "int-en": "en";
    let byLine;
    if (!!sheetOwner && sideColor) {
      title = sheetTitle.stripHtml();
      heTitle = title;
      byLine = sheetOwner;
    }
    const subtitle = displayValue ? (
        <span className="blockLinkSubtitle">
            <span className={elang}>{displayValue}</span>
            <span className={hlang}>{heDisplayValue}</span>
        </span>
    ) : null;

    position = position || 0;
    const isSheet = book === 'Sheet';
    const classes  = classNames({refLink: !isSheet, sheetLink: isSheet, blockLink: 1, recentItem, calendarLink: (subtitle != null), saved });
    url_string = url_string ? url_string : sref;
    let url;
    if (isSheet) {
      url = `/sheets/${Sefaria.normRef(url_string).replace('Sheet.','')}`
    } else {
      url = "/" + Sefaria.normRef(url_string) + Sefaria.util.getUrlVersionsParams(currVersions).replace("&","?");
    }

    if (sideColor) {
      return (
        <a href={url} className={classes} data-ref={sref} data-ven={currVersions.en} data-vhe={currVersions.he} data-position={position}>
          <div className="sideColorLeft" data-ref-child={true}>
            <div className="sideColor" data-ref-child={true} style={{backgroundColor: Sefaria.palette.categoryColor(category)}} />
            <div className="sideColorInner" data-ref-child={true}>
              <span className={elang} data-ref-child={true}>{title}{!!sheetOwner ? (<i className="byLine" data-ref-child={true}>{byLine}</i>) : null}</span>
              <span className={hlang} data-ref-child={true}>{heTitle}{!!sheetOwner ? (<i className="byLine" data-ref-child={true}>{byLine}</i>) : null}</span>
            </div>
          </div>
          <div className="sideColorRight">
            { saved ? <SaveButton historyObject={{ ref: sref, versions: currVersions }} /> : null }
            { !saved && timeStamp ?
              <span className="sans-serif">
                { Sefaria.util.naturalTime(timeStamp) }
              </span>: null
            }
          </div>
        </a>
      );
    }
    return (
      <a href={url} className={classes} data-ref={sref} data-ven={currVersions.en} data-vhe={currVersions.he} data-position={position} style={style}>
        <span className={elang}>{title}</span>
        <span className={hlang}>{heTitle}</span>
        {subtitle}
      </a>
    );
  }
}
TextBlockLink.propTypes = {
  sref:            PropTypes.string.isRequired,
  currVersions:    PropTypes.object.isRequired,
  heRef:           PropTypes.string,
  book:            PropTypes.string,
  category:        PropTypes.string,
  title:           PropTypes.string,
  heTitle:         PropTypes.string,
  displayValue:    PropTypes.string,
  heDisplayValue:  PropTypes.string,
  url_string:      PropTypes.string,
  showSections:    PropTypes.bool,
  recentItem:      PropTypes.bool,
  position:        PropTypes.number,
  sideColor:       PropTypes.bool,
  saved:           PropTypes.bool,
  sheetTitle:      PropTypes.string,
  sheetOwner:      PropTypes.string,
  timeStamp:       PropTypes.number,
};
TextBlockLink.defaultProps = {
  currVersions: {en:null, he:null},
};


class LanguageToggleButton extends Component {
  toggle(e) {
    e.preventDefault();
    this.props.toggleLanguage();
  }
  render() {
    var url = this.props.url || "";
    return (<a href={url} className="languageToggle" onClick={this.toggle}>
              <img className="en" src="/static/img/aleph.svg" alt="Hebrew Language Toggle Icon" />
              <img className="he" src="/static/img/aye.svg" alt="English Language Toggle Icon" />
            </a>);
  }
}
LanguageToggleButton.propTypes = {
  toggleLanguage: PropTypes.func.isRequired,
  url:            PropTypes.string,
};


const ColorBarBox = ({tref, children}) =>  (
  <div className="colorBarBox" style={{"borderColor": Sefaria.palette.refColor(tref)}}>{children}</div>
);


const DangerousInterfaceBlock = ({en, he, classes}) => (
        <div className={classes}>
          <InterfaceText html={{"en": en, "he":he}} />
        </div>
    );
DangerousInterfaceBlock.propTypes = {
    en: PropTypes.string,
    he: PropTypes.string,
    classes: PropTypes.string
};


const SimpleInterfaceBlock = ({en, he, classes}) => (
        <div className={classes}>
            <InterfaceText text={{en:en, he:he}} />
        </div>
    );
SimpleInterfaceBlock.propTypes = {
    en: PropTypes.string,
    he: PropTypes.string,
    classes: PropTypes.string
};


const SimpleContentBlock = ({children, classes}) => (
        <div className={classes}>
          {children}
        </div>
    );
SimpleContentBlock.propTypes = {
    classes: PropTypes.string
};


const SimpleLinkedBlock = ({en, he, url, classes, aclasses, children, onClick, openInNewTab}) => (
  <div className={classes} onClick={onClick}>
    <a href={url} className={aclasses} target={openInNewTab ? "_blank" : "_self"}>
      <InterfaceText text={{en, he}}/>
    </a>
    {children}
  </div>
);
SimpleLinkedBlock.propTypes = {
    en: PropTypes.string,
    he: PropTypes.string,
    url: PropTypes.string,
    classes: PropTypes.string,
    aclasses: PropTypes.string
};


class BlockLink extends Component {
  render() {
    var interfaceClass = this.props.interfaceLink ? 'int-' : '';
    var cn = {blockLink: 1};
    var linkClass = this.props.title.toLowerCase().replace(" ", "-") + "-link";
    cn[linkClass] = 1;
    var classes = classNames(cn);
      return (<a className={classes} href={this.props.target}>
              {this.props.image ? <img src={this.props.image} alt="" /> : null}
              <span className={`${interfaceClass}en`}>{this.props.title}</span>
              <span className={`${interfaceClass}he`}>{this.props.heTitle}</span>
           </a>);
  }
}
BlockLink.propTypes = {
  title:         PropTypes.string,
  heTitle:       PropTypes.string,
  target:        PropTypes.string,
  image:         PropTypes.string,
  interfaceLink: PropTypes.bool
};
BlockLink.defaultProps = {
  interfaceLink: false
};


class ToggleSet extends Component {
  // A set of options grouped together.
  render() {
    let classes = {toggleSet: 1, separated: this.props.separated, blueStyle: this.props.blueStyle };
    classes[this.props.name] = 1;
    classes = classNames(classes);
    const width = 100.0 - (this.props.separated ? (this.props.options.length - 1) * 3 : 0);
    const style = {width: (width/this.props.options.length) + "%"};
    const label = this.props.label ? (<span className="toggle-set-label">{this.props.label}</span>) : null;
    return (
      <div className={classes} role="radiogroup" aria-label={this.props.ariaLabel}>
        {label}
        <div className="toggleSetToggleBox">
          {this.props.options.map((option) => (
          <ToggleOption
            name={option.name}
            key={option.name}
            set={this.props.name}
            role={option.role}
            ariaLabel={option.ariaLabel}
            on={this.props.currentValue == option.name}
            setOption={this.props.setOption}
            style={style}
            image={option.image}
            fa={option.fa}
            content={option.content} />))}
        </div>
      </div>);
  }
}
ToggleSet.propTypes = {
  name:          PropTypes.string.isRequired,
  label:         PropTypes.string,
  setOption:     PropTypes.func.isRequired,
  currentValue:  PropTypes.string,
  options:       PropTypes.array.isRequired,
  separated:     PropTypes.bool,
  blueStyle:     PropTypes.bool,
  role:          PropTypes.string,
  ariaLabel:     PropTypes.string
};


class ToggleOption extends Component {
  // A single option in a ToggleSet

  handleClick() {
    this.props.setOption(this.props.set, this.props.name);
    if (Sefaria.site) { Sefaria.track.event("Reader", "Display Option Click", this.props.set + " - " + this.props.name); }
  }
  checkKeyPress(e){
    if (e.keyCode === 39  || e.keyCode === 40) { //39 is right arrow -- 40 is down
        $(e.target).siblings(".toggleOption").attr("tabIndex","-1");
        $(e.target).attr("tabIndex","-1");
        $(e.target).next(".toggleOption").focus().attr("tabIndex","0");
    }
    else if (e.keyCode === 37 || e.keyCode === 38) { //37 is left arrow -- 38 is up
        $(e.target).siblings(".toggleOption").attr("tabIndex","-1");
        $(e.target).attr("tabIndex","-1");
        $(e.target).prev(".toggleOption").focus().attr("tabIndex","0");
    }
    else if (e.keyCode === 13) { //13 is enter
        $(e.target).trigger("click");
    }
    else if (e.keyCode === 9) { //9 is tab
        var lastTab = $("div[role='dialog']").find(':tabbable').last();
        var firstTab = $("div[role='dialog']").find(':tabbable').first();
        if (e.shiftKey) {
          if ($(e.target).is(firstTab)) {
            $(lastTab).focus();
            e.preventDefault();
          }
        }
        else {
          if ($(e.target).is(lastTab)) {
            $(firstTab).focus();
            e.preventDefault();
          }
        }
    }
    else if (e.keyCode === 27) { //27 is escape
        e.stopPropagation();
        $(".mask").trigger("click");
    }
  }
  render() {
    let classes = {toggleOption: 1, on: this.props.on };
    const tabIndexValue = this.props.on ? 0 : -1;
    const ariaCheckedValue = this.props.on ? "true" : "false";
    classes[this.props.name] = 1;
    classes = classNames(classes);
    const content = this.props.image ? (<img src={this.props.image} alt=""/>) :
                      this.props.fa ? (<i className={"fa fa-" + this.props.fa}></i>) :
                        typeof this.props.content === "string" ? (<span dangerouslySetInnerHTML={ {__html: this.props.content} }></span>) :
                          this.props.content;
    return (
      <div
        role={this.props.role}
        aria-label= {this.props.ariaLabel}
        tabIndex = {this.props.role == "radio"? tabIndexValue : "0"}
        aria-checked={ariaCheckedValue}
        className={classes}
        onKeyDown={this.checkKeyPress}
        onClick={this.handleClick}>
        {content}
      </div>);
  }
}

         //style={this.props.style}

const requestWithCallBack = ({url, setSavingStatus, redirect, type="POST", data={}}) => {
    let ajaxPayload = {url, type};
    if (type === "POST") {
      ajaxPayload.data = {json: JSON.stringify(data)};
    }
    $.ajax({
      ...ajaxPayload,
      success: function(result) {
        if ("error" in result) {
          if (setSavingStatus) {
            setSavingStatus(false);
          }
          alert(result.error);
        } else {
          redirect();
        }
      }
    }).fail(function() {
      alert(Sefaria._("Something went wrong. Sorry!"));
    });
}

 const TopicToCategorySlug = function(topic, category=null) {
   //helper function for AdminEditor
   if (!category) {
     category = Sefaria.topicTocCategory(topic.slug);
   }
   let initCatSlug = category ? category.slug : "Main Menu";    //category topics won't be found using topicTocCategory,
   // so all category topics initialized to "Main Menu"
   if ("displays-under" in topic?.links && "displays-above" in topic?.links) {
     // this case handles categories that are not top level but have children under them
     const displayUnderLinks = topic.links["displays-under"]?.links;
     if (displayUnderLinks && displayUnderLinks.length === 1) {
       initCatSlug = displayUnderLinks[0].topic;
     }
   }
   return initCatSlug;
 }

function useHiddenButtons() {
    const [hideButtons, setHideButtons] = useState(true);
    const handleMouseOverAdminButtons = () => {
        setHideButtons(false);
        setTimeout(() => setHideButtons(true), 3000);
    }
    return [hideButtons, handleMouseOverAdminButtons];
}

const CategoryHeader = ({children, type, data = [], edit = true,
                          add_subcategory = true, reorder = false,
                          add_source = false}) => {
  /*
  Provides an interface for using admin tools.
  `type` is 'sources', 'books' or 'topics'
  `data` is list when `type` === 'books' which tells us where we are in the TOC tree,
        for `type` === 'topics' it's a string with value of topic slug
        for `type` === 'sources' it's a list where the first item is topic slug and second item is source data
   */
  const [editCategory, toggleEditCategory] = useEditToggle();
  const [addCategory, toggleAddCategory] = useEditToggle();
  const [reorderCategory, toggleReorderCategory] = useEditToggle();
  const [addSource, toggleAddSource] = useEditToggle();
  const [hiddenButtons, setHiddenButtons] = useHiddenButtons(true);

  const adminClasses = classNames({adminButtons: 1, hiddenButtons});
  let adminButtonsSpan = null;
  const [topicData, setTopicData] = useState(Sefaria.getTopicFromCache(data));

  if (Sefaria.is_moderator && editCategory) {
    if (data.length === 0) {  // at /texts or /topics
      const url = type === 'topics' ? `/api/topic/reorder` : `/api/category?reorder=1`;
      const redirect = type === 'topics' ? '/topics' : '/texts';
      const origItems = type === 'topics' ? Sefaria.topic_toc : Sefaria.toc;
      adminButtonsSpan = <ReorderEditor close={toggleEditCategory} type={type} origItems={origItems}
                                        postURL={url} redirect={redirect}/>;
    } else if (type === "sources") {
      const [topicSlug, refData] = data;
      adminButtonsSpan = <SourceEditor topic={topicSlug} origData={refData} close={toggleEditCategory}/>;
    } else if (type === "books") {
      let tocObject = Sefaria.tocObjectByCategories(data);
      const origDesc = {en: tocObject.enDesc, he: tocObject.heDesc};
      const origCategoryDesc = {en: tocObject.enShortDesc, he: tocObject.heShortDesc};
      const origData = {
        origEn: tocObject.category,
        origHe: tocObject.heCategory,
        origDesc,
        origCategoryDesc,
        isPrimary: tocObject.isPrimary
      };
      adminButtonsSpan = <CategoryEditor origData={origData} close={toggleEditCategory} origPath={data.slice(0, -1)}/>;
    } else if (type === "topics") {
      if (!topicData) {
        Sefaria.getTopic(data).then(d => {
          setTopicData(d);
        })
      } else {
        const initCatSlug = TopicToCategorySlug(topicData);
        const origData = {
          origSlug: topicData.slug, origCategorySlug: initCatSlug,
          origEn: topicData.primaryTitle.en, origHe: topicData.primaryTitle.he || ""
        };
        origData.origDesc = topicData.description || {"en": "", "he": ""};
        origData.origCategoryDesc = topicData.categoryDescription || {"en": "", "he": ""};
        const origWasCat = "displays-above" in topicData?.links;
        adminButtonsSpan = <TopicEditor origData={origData}
                                        origWasCat={origWasCat}
                                        onCreateSuccess={(slug) => window.location.href = "/topics/" + slug}
                                        close={toggleEditCategory}/>;
      }

    }
  } else if (Sefaria.is_moderator && addSource && type === "topics") {
    adminButtonsSpan = <SourceEditor topic={data} close={toggleAddSource}/>;

  } else if (Sefaria.is_moderator && addCategory) {
    const origData = {origEn: ""};
    if (type === "books") {
      adminButtonsSpan = <CategoryEditor origData={origData} close={toggleAddCategory} origPath={data}/>;
    } else if (type === "topics") {
      origData['origCategorySlug'] = data;
      adminButtonsSpan = <TopicEditor origData={origData} close={toggleAddCategory} origWasCat={false}
                                      onCreateSuccess={(slug) => window.location.href = "/topics/" + slug}/>;
    }
  } else if (Sefaria.is_moderator && reorderCategory) {
    if (!topicData) {
        Sefaria.getTopic(data).then(d => {
          setTopicData(d);
        })
    } else {
      let url = `/api/source/reorder?topic=${topicData.slug}&lang=${Sefaria.interfaceLang}`;
      let refs = topicData.refs?.about?.refs || [];
      if (refs.length) {
        refs = refs.filter((x) => !x.ref.startsWith('Sheet ')).slice(0, Sefaria._topicPageSize);
        refs = refs.sort((a, b) => refSort('relevance', [a.ref, a], [b.ref, b]));
      }
      adminButtonsSpan = <ReorderEditor close={toggleReorderCategory}
                                        postURL={url}
                                        type={'sources'}
                                        origItems={refs}
                                        redirect={`/topics/${topicData.slug}`}/>;
    }
  } else if (Sefaria.is_moderator) {
    adminButtonsSpan = <span className={adminClasses}>
                              { add_subcategory && <AdminEditorButton text="Add sub-category" toggleAddingTopics={toggleAddCategory}/>}
                              { add_source && <AdminEditorButton text="Add a source" toggleAddingTopics={toggleAddSource}/>}
                              { edit && <AdminEditorButton text="Edit" toggleAddingTopics={toggleEditCategory}/>}
                              { reorder && <AdminEditorButton text="Reorder sources" toggleAddingTopics={toggleReorderCategory}/>}
                      </span>;

  }
  const wrapper = addCategory || editCategory || addSource || reorderCategory ? "" : "headerWithAdminButtons";
  return <span className={wrapper}><span
      onMouseEnter={() => setHiddenButtons()}>{children}</span>{adminButtonsSpan}</span>;
}




class SearchButton extends Component {
  render() {
    return (<span className="readerNavMenuSearchButton" onClick={this.props.onClick}>
      <img src="/static/icons/iconmonstr-magnifier-2.svg" />
    </span>);
  }
}


class MenuButton extends Component {
  render() {
    var isheb = Sefaria.interfaceLang == "hebrew";
    var icon = this.props.compare ? (isheb ?
      <i className="fa fa-chevron-right"></i> : <i className="fa fa-chevron-left"></i>) :
        (<i className="fa fa-bars"></i>);
    return (<span className="readerNavMenuMenuButton" onClick={this.props.onClick}>{icon}</span>);
  }
}
MenuButton.propTypes = {
  onClick: PropTypes.func,
  compare: PropTypes.bool,
};


class CloseButton extends Component {
  onClick(e) {
    e.preventDefault();
    this.props.onClick();
  }
  render() {
    if (this.props.icon == "circledX"){
      var icon = <img src="/static/icons/circled-x.svg" />;
    } else if (this.props.icon == "chevron") {
      var icon = <i className="fa fa-chevron-left"></i>
    } else {
      var icon = "×";
    }
    var classes = classNames({readerNavMenuCloseButton: 1, circledX: this.props.icon === "circledX"});
    var url = this.props.url || "";
    return (<a href={url} className={classes} onClick={this.onClick}>{icon}</a>);
  }
}


class DisplaySettingsButton extends Component {
  render() {
    var style = this.props.placeholder ? {visibility: "hidden"} : {};
    var icon = Sefaria._siteSettings.TORAH_SPECIFIC ?
      <img src="/static/img/ayealeph.svg" alt="Toggle Reader Menu Display Settings" style={style} /> :
      <span className="textIcon">Aa</span>;
    return (<a
              className="readerOptions"
              tabIndex="0"
              role="button"
              aria-haspopup="true"
              aria-label="Toggle Reader Menu Display Settings"
              style={style}
              onClick={this.props.onClick}
              onKeyPress={function(e) {e.charCode == 13 ? this.props.onClick(e):null}.bind(this)}>
              {icon}
            </a>);
  }
}
DisplaySettingsButton.propTypes = {
  onClick: PropTypes.func,
  placeholder: PropTypes.bool,
};


function InterfaceLanguageMenu({currentLang, translationLanguagePreference, setTranslationLanguagePreference}){
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const getCurrentPage = () => {
    return isOpen ? (encodeURIComponent(Sefaria.util.currentPath())) : "/";
  }
  const handleClick = (e) => {
    e.stopPropagation();
    setIsOpen(isOpen => !isOpen);
  }
  const handleTransPrefResetClick = (e) => {
    e.stopPropagation();
    setTranslationLanguagePreference(null);
  };
  const handleHideDropdown = (event) => {
      if (event.key === 'Escape') {
          setIsOpen(false);
      }
  };
  const handleClickOutside = (event) => {
      if (
          wrapperRef.current &&
          !wrapperRef.current.contains(event.target)
      ) {
          setIsOpen(false);
      }
  };

  useEffect(() => {
      document.addEventListener('keydown', handleHideDropdown, true);
      document.addEventListener('click', handleClickOutside, true);
      return () => {
          document.removeEventListener('keydown', handleHideDropdown, true);
          document.removeEventListener('click', handleClickOutside, true);
      };
  }, []);

  return (
      <div className="interfaceLinks" ref={wrapperRef}>
        <a className="interfaceLinks-button" onClick={handleClick}><img src="/static/icons/globe-wire.svg"/></a>
        <div className={`interfaceLinks-menu ${ isOpen ? "open" : "closed"}`}>
          <div className="interfaceLinks-header">
            <InterfaceText>Site Language</InterfaceText>
          </div>
          <div className="interfaceLinks-options">
            <a className={`interfaceLinks-option int-bi int-he ${(currentLang == 'hebrew') ? 'active':''}`} href={`/interface/hebrew?next=${getCurrentPage()}`}>עברית</a>
            <a className={`interfaceLinks-option int-bi int-en ${(currentLang == 'english') ? 'active' : ''}`} href={`/interface/english?next=${getCurrentPage()}`}>English</a>
          </div>
          { !!translationLanguagePreference ? (
            <>
              <div className="interfaceLinks-header">
                <InterfaceText>Preferred Translation</InterfaceText>
              </div>
              <div className="interfaceLinks-options trans-pref-header-container">
                <InterfaceText>{Sefaria.translateISOLanguageCode(translationLanguagePreference, true)}</InterfaceText>
                <a className="trans-pref-reset" onClick={handleTransPrefResetClick}>
                  <img src="/static/img/circled-x.svg" className="reset-btn" />
                  <span className="smallText">
                    <InterfaceText>Reset</InterfaceText>
                  </span>
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
  );
}
InterfaceLanguageMenu.propTypes = {
  currentLang: PropTypes.string,
  translationLanguagePreference: PropTypes.string,
};


function SaveButton({historyObject, placeholder, tooltip, toggleSignUpModal}) {
  if (!historyObject) { placeholder = true; }
  const isSelected = () => !!Sefaria.getSavedItem(historyObject);
  const [selected, setSelected] = useState(placeholder || isSelected());
  useEffect(() => {
    if (placeholder) { return; }
    setSelected(isSelected())
  }, [historyObject && historyObject.ref]);

  const [isPosting, setPosting] = useState(false);

  const style = placeholder ? {visibility: 'hidden'} : {};
  const classes = classNames({saveButton: 1, "tooltip-toggle": tooltip});
  const altText = placeholder ? '' :
      `${Sefaria._(selected ? "Remove" : "Save")} "${historyObject.sheet_title ?
          historyObject.sheet_title.stripHtml() : Sefaria._r(historyObject.ref)}"`;

  function onClick(event) {
    if (isPosting) { return; }
    event.preventDefault();
    setPosting(true);
    Sefaria.track.event("Saved", "saving", historyObject.ref);
    Sefaria.toggleSavedItem(historyObject)
        .then(() => { setSelected(isSelected()); }) // since request is async, check if it's selected from data
        .catch(e => { if (e == 'notSignedIn') { toggleSignUpModal(SignUpModalKind.Save); }})
        .finally(() => { setPosting(false); });
  }

  return (
    <ToolTipped {...{ altText, classes, style, onClick }}>
      { selected ? <img src="/static/icons/bookmark-filled.svg" alt={altText}/> :
        <img src="/static/icons/bookmark.svg" alt={altText}/> }
    </ToolTipped>
  );
}
SaveButton.propTypes = {
  historyObject: PropTypes.shape({
    ref: PropTypes.string,
    versions: PropTypes.object,
  }),
  placeholder: PropTypes.bool,
  tooltip: PropTypes.bool,
  toggleSignUpModal: PropTypes.func,
};


const ToolTipped = ({ altText, classes, style, onClick, children }) => (
  <div aria-label={altText} tabIndex="0"
    className={classes} role="button"
    style={style} onClick={onClick}
    onKeyPress={e => {e.charCode == 13 ? onClick(e): null}}>
    { children }
  </div>
);


class FollowButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
      following: props.following, // Deal w/ case where we don't know?
      hovering: false
    }
  }
  _postFollow() {
    $.post("/api/follow/" + this.props.uid, {}, data => {
      Sefaria.following.push(this.props.uid);  // keep local following list up-to-date
      Sefaria.track.event("Following", "New Follow", this.props.uid);
    });
  }
  _postUnfollow() {
    $.post("/api/unfollow/" + this.props.uid, {}, data => {
      Sefaria.following = Sefaria.following.filter(i => i !== this.props.uid);  // keep local following list up-to-date
      Sefaria.track.event("Following", "Unfollow", this.props.uid);
    });
  }
  onMouseEnter() {
    if (this.props.disableUnfollow) { return; }
    this.setState({hovering: true});
  }
  onMouseLeave() {
    this.setState({hovering: false});
  }
  onClick(e) {
    e.stopPropagation();
    if (!Sefaria._uid) {
      this.props.toggleSignUpModal(SignUpModalKind.Follow);
      return;
    }
    if (this.state.following && !this.props.disableUnfollow) {
      this._postUnfollow();
      this.setState({following: false});
    } else {
      this._postFollow();
      this.setState({following: true, hovering: false});  // hovering:false keeps the "unfollow" from flashing.
    }
  }
  render() {
    const classes = this.props.classes ? this.props.classes : classNames({
      largeFollowButton: this.props.large,
      smallFollowButton: !this.props.large,
      following: this.state.following,
      hovering: this.state.hovering,
      smallText: !this.props.large,
    });
    let buttonText = this.state.following ? this.state.hovering ?  "Unfollow" : "Following" : "Follow";
    buttonText = buttonText === "Follow" && this.props.followBack ? "Follow Back" : buttonText;
    return (
      <div className={classes} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave} onClick={this.onClick}>
        {this.props.icon ? <img src={`/static/icons/${this.state.following ? this.state.hovering ?  "checkmark" : "checkmark" : "follow"}.svg`} aria-hidden="true"/> : null}
        <InterfaceText context={"FollowButton"}>{buttonText}</InterfaceText>
      </div>
    );
  }
}
FollowButton.propTypes = {
  uid:               PropTypes.number.isRequired,
  following:         PropTypes.bool,  // is this person followed already?
  large:             PropTypes.bool,
  disableUnfollow:   PropTypes.bool,
  followBack:        PropTypes.bool,
  toggleSignUpModal: PropTypes.func,

};


const CategoryColorLine = ({category}) =>
  <div className="categoryColorLine" style={{background: Sefaria.palette.categoryColor(category)}}/>;


class ProfileListing extends Component {
  render() {
    const { url, image, name, uid, is_followed, toggleSignUpModal, smallfonts, organization } = this.props;
    return (
      <div className={"authorByLine sans-serif" + (smallfonts ? " small" : "")}>
        <div className="authorByLineImage">
          <a href={url}>
            <ProfilePic
              len={smallfonts ? 30 : 40}
              url={image}
              name={name}
            />
          </a>
        </div>
        <div className={`authorByLineText ${smallfonts? "small" : ""}`}>
          <SimpleLinkedBlock
            classes="authorName"
            url={url}
            en={name}
            he={name}
          >
            <FollowButton
              large={false}
              uid={uid}
              following={is_followed}
              disableUnfollow={true}
              toggleSignUpModal={toggleSignUpModal} />
          </SimpleLinkedBlock>
          {!!organization ?
          <SimpleInterfaceBlock
            classes="authorOrganization"
            en={organization}
            he={organization} />
          :null}
        </div>
      </div>
    );
  }
}
ProfileListing.propTypes = {
  uid:               PropTypes.number.isRequired,
  url:               PropTypes.string.isRequired,
  image:             PropTypes.string.isRequired,
  name:              PropTypes.string.isRequired,
  is_followed:       PropTypes.bool,
  toggleSignUpModal: PropTypes.func,
};


const SheetListing = ({
  sheet, connectedRefs, handleSheetClick, handleSheetDelete, handleCollectionsChange,
  editable, deletable, saveable, collectable, pinnable, pinned, pinSheet,
  hideAuthor, showAuthorUnderneath, infoUnderneath, hideCollection, openInNewTab, toggleSignUpModal, showSheetSummary
}) => {
  // A source sheet presented in lists, like sidebar or profile page
  const [showCollectionsModal, setShowCollectionsModal] = useState(false);

  const handleSheetClickLocal = (e) => {
    //console.log("Sheet Click Handled");
    // TODO: There more contexts to distinguish / track. Profile, collections, search
    if (Sefaria._uid == sheet.owner) {
      Sefaria.track.event("Tools", "My Sheet Click", sheet.sheetUrl);
    } else {
      Sefaria.track.event("Tools", "Sheet Click", sheet.sheetUrl);
    }
    if (handleSheetClick) {
      Sefaria.track.sheets("Opened via Connections Panel", connectedRefs.toString());
      handleSheetClick(e, sheet, null, connectedRefs);
      e.preventDefault();
    }
  };

  const handleSheetOwnerClick = (e) => {
    Sefaria.track.event("Tools", "Sheet Owner Click", sheet.ownerProfileUrl);
  };

  const handleTopicClick = (topic) => {
    Sefaria.track.event("Tools", "Topic Click", topic);
  };

  const handleSheetDeleteClick = () => {
    if (confirm(Sefaria._("Are you sure you want to delete this sheet? There is no way to undo this action."))) {
      Sefaria.sheets.deleteSheetById(sheet.id).then(handleSheetDelete);
    }
  };

  const toggleCollectionsModal = () => {
    if (Sefaria._uid) {
      setShowCollectionsModal(!showCollectionsModal);
    } else {
      toggleSignUpModal(SignUpModalKind.AddToSheet);
    }
  };

  const title = sheet.title ? sheet.title.stripHtmlConvertLineBreaks() : "Untitled Source Sheet";

  const viewsIcon = sheet.public ?
    <div className="sheetViews sans-serif"><i className="fa fa-eye" title={sheet.views + " views"}></i> {sheet.views}</div>
    : <div className="sheetViews sans-serif"><i className="fa fa-lock" title="Private"></i></div>;

  const views = (
    <>
      {sheet.views}&nbsp;<InterfaceText>Views</InterfaceText>
    </>
  );

  const sheetSummary = showSheetSummary && sheet.summary?
  <DangerousInterfaceBlock classes={"smallText sheetSummary"} en={sheet.summary} he={sheet.sheet_summary}/>:null;

  const sheetInfo = hideAuthor ? null :
      <div className="sheetInfo">
        <div className="sheetUser">
          <a href={sheet.ownerProfileUrl} target={openInNewTab ? "_blank" : "_self"}>
            <ProfilePic
              outerStyle={{display: "inline-block"}}
              name={sheet.ownerName}
              url={sheet.ownerImageUrl}
              len={26}
            />
          </a>
          <a href={sheet.ownerProfileUrl} target={openInNewTab ? "_blank" : "_self"} className="sheetAuthor" onClick={handleSheetOwnerClick}>{sheet.ownerName}</a>
        </div>
        {viewsIcon}
      </div>

  const collectionsList = "collections" in sheet ? sheet.collections.slice() : [];
  if (sheet.displayedCollectionName) {
    collectionsList.unshift({name: sheet.displayedCollectionName, slug: sheet.displayedCollection});
  }
  const collections = collectionsList.map((collection, i) => {
    const separator = i == collectionsList.length -1 ? null : <span className="separator">,</span>;
    return (
      <a href={`/collections/${collection.slug}`}
        target={openInNewTab ? "_blank" : "_self"}
        className="sheetTag"
        key={i}
      >
        {collection.name}
        {separator}
      </a>
    );
  });

  const topics = sheet.topics.map((topic, i) => {
    const separator = i == sheet.topics.length -1 ? null : <span className="separator">,</span>;
    return (
      <a href={`/topics/${topic.slug}`}
        target={openInNewTab ? "_blank" : "_self"}
        className="sheetTag"
        key={i}
        onClick={handleTopicClick.bind(null, topic.slug)}
      >
        <InterfaceText text={topic} />
        {separator}
      </a>
    );
  });
  const created = Sefaria.util.localeDate(sheet.created);
  const underInfo = infoUnderneath ? [
      sheet.status !== 'public' ? (<span className="unlisted"><img src="/static/img/eye-slash.svg"/><span>{Sefaria._("Not Published")}</span></span>) : undefined,
      showAuthorUnderneath ? (<a href={sheet.ownerProfileUrl} target={openInNewTab ? "_blank" : "_self"}>{sheet.ownerName}</a>) : undefined,
      views,
      created,
      collections.length ? collections : undefined,
      sheet.topics.length ? topics : undefined,
    ].filter(x => x !== undefined) : [topics];


  const pinButtonClasses = classNames({sheetListingPinButton: 1, pinned: pinned, active: pinnable});
  const pinMessage = pinned && pinnable ? Sefaria._("Pinned Sheet - click to unpin") :
                    pinned ? Sefaria._("Pinned Sheet") : Sefaria._("Pin Sheet");
  const pinButton = <img src="/static/img/pin.svg" className={pinButtonClasses} title={pinMessage} onClick={pinnable ? pinSheet : null} />

  return (
    <div className="sheet" key={sheet.sheetUrl}>
      <div className="sheetLeft">
        {sheetInfo}
        <a href={sheet.sheetUrl} target={openInNewTab ? "_blank" : "_self"} className="sheetTitle" onClick={handleSheetClickLocal}>
          <img src="/static/img/sheet.svg" className="sheetIcon"/>
          <span className="sheetTitleText">{title}</span>
        </a>
        {sheetSummary}
        <div className="sheetTags sans-serif">
          {
            underInfo.map((item, i) => (
              <span key={i}>
                { i !== 0 ? <span className="bullet">{'\u2022'}</span> : null }
                {item}
              </span>
            ))
          }
        </div>
      </div>
      <div className="sheetRight">
        {
          editable && !Sefaria._uses_new_editor ?
            <a target="_blank" href={`/sheets/${sheet.id}?editor=1`}><img src="/static/icons/tools-write-note.svg" title={Sefaria._("Edit")}/></a>
            : null
        }
        {
          collectable ?
            <img src="/static/icons/collection.svg" onClick={toggleCollectionsModal} title={Sefaria._("Add to Collection")} />
            : null
        }
        {
          deletable ?
            <img src="/static/icons/circled-x.svg" onClick={handleSheetDeleteClick} title={Sefaria._("Delete")} />
            : null
        }
        {
          saveable ?
            <SaveButton historyObject={{ ref: `Sheet ${sheet.id}`, versions: {}  }}
              toggleSignUpModal={toggleSignUpModal} />
            : null
        }
        { pinnable || pinned ?
            pinButton
            : null
        }
      </div>
      {showCollectionsModal ?
        <CollectionsModal
          sheetID={sheet.id}
          close={toggleCollectionsModal}
          handleCollectionsChange={handleCollectionsChange} />
        : null
      }
    </div>);
};


const CollectionListing = ({data}) => {
  const imageUrl = "/static/icons/collection.svg";
  const collectionUrl = "/collections/" + data.slug;
  return (
    <div className="collectionListing">
      <div className="left-content">
        <div className="collectionListingText">

          <a href={collectionUrl} className="collectionListingName">
            <img className="collectionListingImage" src={imageUrl} alt="Collection Icon"/>
            {data.name}
          </a>

          <div className="collectionListingDetails">
            {data.listed ? null :
              (<span className="unlisted">
                <img src="/static/img/eye-slash.svg"/>
                <InterfaceText>Unlisted</InterfaceText>
              </span>) }

            {data.listed ? null :
            <span className="collectionListingDetailSeparator">•</span> }

            <span className="collectionListingDetail collectionListingSheetCount">
              <InterfaceText>{`${data.sheetCount} `}</InterfaceText>
              <InterfaceText>Sheets</InterfaceText>
            </span>

            {data.memberCount > 1 ?
            <span className="collectionListingDetailSeparator">•</span> : null }

            {data.memberCount > 1 ?
            <span className="collectionListingDetail collectionListingMemberCount">
              <InterfaceText>{`${data.memberCount} `}</InterfaceText>
              <InterfaceText>Editors</InterfaceText>
            </span> : null }
          </div>
        </div>
      </div>
    </div>
  );
}


class Note extends Component {
  // Public or private note in the Sidebar.
  render() {
    var authorInfo = this.props.ownerName && !this.props.isMyNote ?
        (<div className="noteAuthorInfo">
          <a href={this.props.ownerProfileUrl}>
            <img className="noteAuthorImg" src={this.props.ownerImageUrl} />
          </a>
          <a href={this.props.ownerProfileUrl} className="noteAuthor">{this.props.ownerName}</a>
        </div>) : null;

      var buttons = this.props.isMyNote ?
                    (<div className="noteButtons">
                      <i className="editNoteButton fa fa-pencil" title="Edit Note" onClick={this.props.editNote} ></i>
                    </div>) : null;

      var text = Sefaria.util.linkify(this.props.text);
      text = text.replace(/\n/g, "<br />");

      return (<div className="note">
                {buttons}
                {authorInfo}
                <div className="noteContent">
                  <span className="noteText" dangerouslySetInnerHTML={{__html:text}}></span>
                </div>
              </div>);
  }
}
Note.propTypes = {
  text:            PropTypes.string.isRequired,
  ownerName:       PropTypes.string,
  ownerImageUrl:   PropTypes.string,
  ownerProfileUrl: PropTypes.string,
  isPrivate:       PropTypes.bool,
  isMyNote:        PropTypes.bool,
  editNote:        PropTypes.func
};


class MessageModal extends Component {
  constructor(props) {
    super(props);
    this.textarea = React.createRef();
    this.state = {
      visible: false,
      message: '',
    };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.visible && !prevState.visible) {
      this.textarea.current.focus();
    }
  }
  onChange(e) { this.setState({ message: e.target.value }); }
  onSend(e) {
    if (!this.state.message) { return; }
    Sefaria.messageAPI(this.props.uid, this.state.message).then(() => {
      this.setState({ visible: false });
      alert("Message Sent");
      Sefaria.track.event("Messages", "Message Sent", "");
    });
  }
  makeVisible() { this.setState({ visible: true }); }
  onCancel(e) { this.setState({ visible: false }); }
  render() {
    if (!this.state.visible) { return null; }
    return (
      <div id="interruptingMessageBox" className="sefariaModalBox sans-serif">
        <div id="interruptingMessageOverlay" onClick={this.onCancel}></div>
        <div id="interruptingMessage" className='message-modal' style={{display: 'block'}}>
          <div className='messageHeader'>{ `${Sefaria._("Send a message to ")}${this.props.name}` }</div>
          <textarea value={this.state.message} onChange={this.onChange} ref={this.textarea} />
          <div className='sendMessage button' onClick={this.onSend}>{ Sefaria._("Send") }</div>
          <div className='cancel button white' onClick={this.onCancel}>{ Sefaria._("Cancel") }</div>
        </div>
      </div>
    );
  }
}
MessageModal.propTypes = {
  name: PropTypes.string.isRequired,
  uid:  PropTypes.number.isRequired,
};

function NewsletterSignUpForm(props) {
  const {contextName, includeEducatorOption} = props;
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [educatorCheck, setEducatorCheck] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState(null);
  const [showNameInputs, setShowNameInputs] = useState(false);

  function handleSubscribeKeyUp(e) {
    if (e.keyCode === 13) {
      handleSubscribe();
    }
  }

  function handleSubscribe() {
    if (showNameInputs === true) { // submit
      if (firstName.length > 0 & lastName.length > 0) {
        setSubscribeMessage("Subscribing...");
        const request = new Request(
        '/api/subscribe/'+email,
        {headers: {'X-CSRFToken': Cookies.get('csrftoken')},
        'Content-Type': 'application/json'}
        );
        fetch(request,
            {
              method: "POST",
              mode: 'same-origin',
              credentials: 'same-origin',
              body: JSON.stringify({
                language: Sefaria.interfaceLang === "hebrew" ? "he" : "en",
                educator: educatorCheck,
                firstName: firstName,
                lastName: lastName
              })
            }
        ).then(res => {
          if ("error" in res) {
            setSubscribeMessage(res.error);
            setShowNameInputs(false);
          } else {
          setSubscribeMessage("Subscribed! Welcome to our list.");
          Sefaria.track.event("Newsletter", "Subscribe from " + contextName, "");
        }
        }).catch(data => {
          setSubscribeMessage("Sorry, there was an error.");
          setShowNameInputs(false);
        });
      } else {
        setSubscribeMessage("Please enter a valid first and last name");// get he copy
      }
    } else if (Sefaria.util.isValidEmailAddress(email)) {
      setShowNameInputs(true);
    } else {
      setShowNameInputs(false);
      setSubscribeMessage("Please enter a valid email address.");
    }
  }

  return (
      <div className="newsletterSignUpBox">
      <span className="int-en">
        <input
            className="newsletterInput"
            placeholder="Sign up for Newsletter"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
        <span className="int-he">
        <input
            className="newsletterInput"
            placeholder="הרשמו לניוזלטר"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
        {!showNameInputs ? <img src="/static/img/circled-arrow-right.svg" onClick={handleSubscribe}/> : null}
        {showNameInputs ?
            <><span className="int-en">
        <input
            className="newsletterInput firstNameInput"
            placeholder="First Name"
            value={firstName}
            autoFocus
            onChange={e => setFirstName(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
              <span className="int-he">
        <input
            className="newsletterInput firstNameInput"
            placeholder="שם פרטי"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
              <span className="int-en">
        <input
            className="newsletterInput"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
              <span className="int-he">
        <input
            className="newsletterInput"
            placeholder="שם משפחה"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            onKeyUp={handleSubscribeKeyUp}/>
      </span>
              <div className="newsletterEducatorOption">
          <span className="int-en">
            <input
                type="checkbox"
                className="educatorNewsletterInput"
                checked={educatorCheck}
                onChange={e => setEducatorCheck(!!e.target.checked)}/>
            <span>I am an educator</span>
          </span>
                <span className="int-he">
            <input
                type="checkbox"
                className="educatorNewsletterInput"
                checked={educatorCheck}
                onChange={e => setEducatorCheck(!!e.target.checked)}/>
            <span>מורים/ אנשי הוראה</span>
          </span>
                <img src="/static/img/circled-arrow-right.svg" onClick={handleSubscribe}/>
              </div>
            </>
            : null}
        {subscribeMessage ?
            <div className="subscribeMessage">{Sefaria._(subscribeMessage)}</div>
            : null}
      </div>
  );
}


class LoginPrompt extends Component {
  render() {
    var nextParam = "?next=" + Sefaria.util.currentPath();
    return (
      <div className="loginPrompt">
        <div className="loginPromptMessage">
          <span className="int-en">Please log in to use this feature.</span>
          <span className="int-he">עליך להיות מחובר בכדי להשתמש באפשרות זו.</span>
        </div>
        <a className="button" href={"/login" + nextParam}>
          <span className="int-en">Log In</span>
          <span className="int-he">התחברות</span>
        </a>
        <a className="button" href={"/register" + nextParam}>
          <span className="int-en">Sign Up</span>
          <span className="int-he">הרשמה</span>
        </a>
      </div>);
  }
}
LoginPrompt.propTypes = {
  fullPanel: PropTypes.bool,
};

class SignUpModal extends Component {
  render() {
    let modalContent = !this.props.modalContentKind ? generateContentForModal() : generateContentForModal(this.props.modalContentKind);

    const innerContent = modalContent.contentList.map(bullet => (
      <div key={bullet.icon}>
        <img src={`/static/img/${bullet.icon}`} alt={bullet.bulletContent.en} />
        <InterfaceText text={bullet.bulletContent} />
      </div>
    ));
    const nextParam = "?next=" + encodeURIComponent(Sefaria.util.currentPath());

    return (
      this.props.show ? <div id="interruptingMessageBox" className="sefariaModalBox">
        <div id="interruptingMessageOverlay" onClick={this.props.onClose}></div>
        <div id="interruptingMessage" className="sefariaModalContentBox">
          <div id="interruptingMessageClose" className="sefariaModalClose" onClick={this.props.onClose}>×</div>
          <div className="sefariaModalContent">
            <h2 className="serif sans-serif-in-hebrew">
              <InterfaceText text={modalContent.h2} />
            </h2>
            <h3>
              <InterfaceText text={modalContent.h3} />
            </h3>
            <div className="sefariaModalInnerContent">
              { innerContent }
            </div>
            <a className="button white control-elem" href={"/register" + nextParam}>
              <InterfaceText>Sign Up</InterfaceText>
            </a>
            <div className="sefariaModalBottomContent">
              <InterfaceText>Already have an account?</InterfaceText>&nbsp;
              <a href={"/login" + nextParam}><InterfaceText>Sign in</InterfaceText></a>
            </div>
          </div>
        </div>
      </div> : null
    );
  }
}
SignUpModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  modalContent: PropTypes.object.isRequired,
};


// class InterruptingMessage extends Component {
//   constructor(props) {
//     super(props);
//     this.displayName = 'InterruptingMessage';
//     this.state = {
//       timesUp: false,
//       animationStarted: false
//     };
//     this.settings = {
//       "modal": {
//         "trackingName": "Interrupting Message",
//         "showDelay": 10000,
//       },
//       "banner": {
//         "trackingName": "Banner Message",
//         "showDelay": 1,
//       }
//     }[this.props.style];
//   }
//   componentDidMount() {
//     if (this.shouldShow()) {
//       this.delayedShow();
//     }
//   }
//   shouldShow() {
//     const excludedPaths = ["/donate", "/mobile", "/app", "/ways-to-give"];
//     return excludedPaths.indexOf(window.location.pathname) === -1;
//   }
//   delayedShow() {
//     setTimeout(function() {
//       this.setState({timesUp: true});
//       $("#interruptingMessage .button").click(this.close);
//       $("#interruptingMessage .trackedAction").click(this.trackAction);
//       this.showAorB();
//       this.animateOpen();
//     }.bind(this), this.settings.showDelay);
//   }
//   animateOpen() {
//     setTimeout(function() {
//       if (this.props.style === "banner" && $("#s2").hasClass("headerOnly")) { $("body").addClass("hasBannerMessage"); }
//       this.setState({animationStarted: true});
//       this.trackOpen();
//     }.bind(this), 50);
//   }
//   showAorB() {
//     // Allow random A/B testing if items are tagged ".optionA", ".optionB"
//     const $message = $(ReactDOM.findDOMNode(this));
//     if ($message.find(".optionA").length) {
//       console.log("rand show")
//       Math.random() > 0.5 ? $(".optionA").show() : $(".optionB").show();
//     }
//   }
//   close() {
//     this.markAsRead();
//     this.props.onClose();
// //   if (this.props.style === "banner" && $("#s2").hasClass("headerOnly")) { $("body").removeClass("hasBannerMessage"); }
//   }
//   trackOpen() {
//     Sefaria.track.event(this.settings.trackingName, "open", this.props.messageName, { nonInteraction: true });
//   }
//   trackAction() {
//     Sefaria.track.event(this.settings.trackingName, "action", this.props.messageName, { nonInteraction: true });
//   }
//   markAsRead() {
//     Sefaria._api("/api/interrupting-messages/read/" + this.props.messageName, function (data) {});
//     var cookieName = this.props.messageName + "_" + this.props.repetition;
//     $.cookie(cookieName, true, { path: "/", expires: 14 });
//     Sefaria.track.event(this.settings.trackingName, "read", this.props.messageName, { nonInteraction: true });
//     Sefaria.interruptingMessage = null;
//   }
//   render() {
//     if (!this.state.timesUp) { return null; }

//     if (this.props.style === "banner") {
//       return  <div id="bannerMessage" className={this.state.animationStarted ? "" : "hidden"}>
//                 <div id="bannerMessageContent" dangerouslySetInnerHTML={ {__html: this.props.messageHTML} }></div>
//                 <div id="bannerMessageClose" onClick={this.close}>×</div>
//               </div>;

//     } else if (this.props.style === "modal") {
//       return  <div id="interruptingMessageBox" className={this.state.animationStarted ? "" : "hidden"}>
//           <div id="interruptingMessageOverlay"></div>
//           <div id="interruptingMessage">
//             <div className="colorLine"></div>
//             <div id="interruptingMessageContentBox" className="hasColorLine">
//               <div id="interruptingMessageClose" onClick={this.close}>×</div>
//               <div id="interruptingMessageContent" dangerouslySetInnerHTML={ {__html: this.props.messageHTML} }></div>
//               {/* <div id="interruptingMessageContent" dangerouslySetInnerHTML={ {__html: this.strapi.interruptingMessageModal ? interruptingMessageModal.modalText : null } }></div> */}
//               <div className="colorLine"></div>
//             </div>
//           </div>
//         </div>;
//     }
//     return null;
//   }
// }
// InterruptingMessage.propTypes = {
//   messageName: PropTypes.string.isRequired,
//   messageHTML: PropTypes.string.isRequired,
//   style:       PropTypes.string.isRequired,
//   repetition:  PropTypes.number.isRequired, // manual toggle to refresh an existing message
//   onClose:     PropTypes.func.isRequired
// };


function OnInView({ children, onVisible }) {
  const elementRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onVisible();
        }
      },
      { threshold: 1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [onVisible]);

  return <div ref={elementRef}>{children}</div>;
}

// let isNewVisitor = JSON.parse(localStorage.getItem("isNewVisitor"));
function isNewVisitor() {
  return (
    "isNewVisitor" in sessionStorage ||
    ("isNewVisitor" in localStorage &&
      JSON.parse(localStorage.getItem("isNewVisitor")))
  );
}

function isReturningVisitor() {
  return (
    !isNewVisitor() &&
    "isReturningVisitor" in localStorage &&
    JSON.parse(localStorage.getItem("isReturningVisitor"))
  );
}
let shouldShowModal = false;

const InterruptingMessage = ({
  messageName,
  messageHTML,
  style,
  repetition,
  onClose,
}) => {
  const [timesUp, setTimesUp] = useState(false);
  const [hasSeenModal, setHasSeenModal] = useState(false);
  const strapi = useContext(StrapiDataContext);
  const settings = {
    trackingName: "Interrupting Message",
    showDelay: 2000,
  };

  // Need to figure out caching for Strapi so multiple queries aren't made on different page loads
  // Use user context to determine whether this is valid for a user?
  // Maybe user context should be used to find if there's a compatible modal
  const shouldShow = () => {
    if (!strapi.interruptingMessageModal) return false;
    if (!shouldShowModal) return false;
    const excludedPaths = ["/donate", "/mobile", "/app", "/ways-to-give"];
    return (
      !JSON.parse(
        sessionStorage.getItem(
          "modal_" + strapi.interruptingMessageModal.internalModalName
        )
      ) && excludedPaths.indexOf(window.location.pathname) === -1
    );
  };

  const closeModal = (eventDescription) => {
    if (onClose) onClose();
    sessionStorage.setItem(
      "modal_" + strapi.interruptingMessageModal.internalModalName,
      "true"
    ); // maybe use modals as key and manipulate object entered
    console.log(eventDescription);
    gtag("event", "modal_interacted_with_" + eventDescription, {
      campaignID: strapi.interruptingMessageModal.internalModalName,
      adType: "modal",
    });
    setHasSeenModal(true); // should be interacted instead of seen because there was an interaction
    // Sefaria.interruptingMessageModal = null;
  };

  const trackImpression = () => {
    console.log("We've got visibility!");
    gtag("event", "modal_viewed", {
      campaignID: strapi.interruptingMessageModal.internalModalName,
      adType: "modal",
    });
  };

  useEffect(() => {
    if (Sefaria._uid) {
      console.log("hitting logged in user");
      try {
        localStorage.setItem("isNewVisitor", "false");
        sessionStorage.setItem("isNewVisitor", "false");
        localStorage.setItem("isReturningVisitor", "true");
      } catch {
        shouldShowModal = true;
      }
      if (strapi.interruptingMessageModal?.showToReturningVisitors) {
        shouldShowModal = true;
      }
      if (Sefaria.is_sustainer) {
        console.log("we got ourselves a beautiful sustainer!");
      }
      if (Sefaria.is_sustainer && strapi.interruptingMessageModal?.showToSustainers) {
        shouldShowModal = true
      }
      else if (!Sefaria.is_sustainer && strapi.interruptingMessageModal?.showToNonSustainers) {
        shouldShowModal = true;
      }
    } else {
      if (!isNewVisitor() && !isReturningVisitor()) {
        console.log("not new visitor or returning visitor"); // first time here
        try {
          localStorage.setItem("isNewVisitor", "false");
          sessionStorage.setItem("isNewVisitor", "true");
          localStorage.setItem("isReturningVisitor", "true"); // This will make the current visitor a returning one once their session is cleared
          // sessionStorage.setItem("isReturningVisitor", "false");
        } catch {
          shouldShowModal = true;
        }
      } else if (isReturningVisitor()) {
        console.log("returning visitor");
        if (strapi.interruptingMessageModal?.showToReturningVisitors) {
          shouldShowModal = true;
        }
      } else if (isNewVisitor()) {
        console.log("new visitor");
        if (strapi.interruptingMessageModal?.showToNewVisitors) {
          shouldShowModal = true;
        }
      }
    }
    if (
      strapi.interruptingMessageModal &&
      !strapi.interruptingMessageModal.showToNewVisitors &&
      !strapi.interruptingMessageModal.showToReturningVisitors
    ) {
      // Show to everyone if there is no state passed from Strapi
      shouldShowModal = true;
    }

    if (shouldShow()) {
      const timeoutId = setTimeout(() => {
        setTimesUp(true);
        // Other stuff here
      }, settings.showDelay);
      return () => clearTimeout(timeoutId); // clearTimeout on component unmount
    }
  }, [strapi.interruptingMessageModal, settings.showDelay]); // execute useEffect when the modal or showDelay changes

  if (!timesUp) return null;
  console.log("data for the component");
  console.log(strapi.interruptingMessageModal);

  if (!hasSeenModal) {
    console.log("rendering component");
    return (
      <OnInView onVisible={trackImpression}>
        <div id="interruptingMessageBox" className={timesUp ? "" : "hidden"}>
          <div id="interruptingMessageOverlay"></div>
          <div id="interruptingMessage">
            <div className="colorLine"></div>
            <div id="interruptingMessageContentBox" className="hasColorLine">
              <div
                id="interruptingMessageClose"
                onClick={() => {
                  closeModal("close_clicked");
                }}
              >
                ×
              </div>
              {/* <div id="interruptingMessageContent" dangerouslySetInnerHTML={ {__html: strapi.interruptingMessageModal ? strapi.interruptingMessageModal.modalText : null } }></div> */}
              <div id="interruptingMessageContent">
                <style>
                  {`#highHolidayDonation {
                      width: 410px;
                      max-height: 100%;
                      max-width: 100%;
                  }
                  .interface-english #highHolidayDonation {
                      text-align: left;
                  }
                  .interface-hebrew #highHolidayDonation {
                      text-align: right;
                      direction: rtl;
                  }
                  #highHolidayDonation p {
                      color: #555;
                  }
                  .interface-hebrew p.int-en {
                      display: none;
                  }
                  #highHolidayDonation p .int-en {
                      font-family: "adobe-garamond-pro", Georgia, serif;
                  }
                  #highHolidayDonation p .int-he {
                      font-family: "adobe-garamond-pro", Georgia, serif;
                      /* font-family: "Heebo", sans-serif; */
                  }
                  #highHolidayDonation p.sub {
                      color: #999;
                      font-size: 12px;
                      font-family: "Roboto", "Helvetica Neue", Helvetica, sans-serif;
                  }
                  #highHolidayDonation p {
                      margin-top: 0;
                  }
                  #highHolidayDonation .button {
                      margin-bottom: 20px;
                  }
                  #highHolidayDonation img {
                      max-width: 100%;
                  }
                  #highHolidayDonation .buttons{
                      text-align: right;
                  }
                  .leader {
                      font-weight: bold;
                  }
                  .center{
                      text-align: center;
                  }
                  #email-input-wrapper {
                      display: flex;
                      align-items: flex-start;
                      flex-direction: column;
                  }
                  .newsletterInput#email-input {
                      width: 300px;
                      padding: 10px;
                      margin-bottom: 20px;
                      border-radius: 7px;
                      border: 1px solid #EEE;
                      color: #333;
                  }`}
                </style>
                <div id="highHolidayDonation">
                  <p>
                    <span className="int-en">
                      {strapi.interruptingMessageModal.modalText}
                    </span>
                  </p>
                  <div className="buttons">
                    <a
                      className="button int-en"
                      target="_blank"
                      href={strapi.interruptingMessageModal.buttonURL}
                      onClick={() => {
                        closeModal("donate_button_clicked");
                      }}
                    >
                      <span className="int-en">
                        {strapi.interruptingMessageModal.buttonText}
                      </span>
                    </a>
                  </div>
                </div>
              </div>
              <div className="colorLine"></div>
            </div>
          </div>
        </div>
      </OnInView>
    );
  } else {
    return null;
  }
};

// InterruptingMessage.propTypes = {
//   messageName: PropTypes.string.isRequired,
//   messageHTML: PropTypes.string.isRequired,
//   style: PropTypes.string.isRequired,
//   repetition: PropTypes.number.isRequired,
//   onClose: PropTypes.func.isRequired
// };


const NBox = ({ content, n, stretch, gap=0  }) => {
  // Wrap a list of elements into an n-column flexbox
  // If `stretch`, extend the final row into any remaining empty columns
  let length = content.length;
  let rows = [];
  for (let i=0; i<length; i+=n) {
    rows.push(content.slice(i, i+n));
  }
  return (
    <div className="gridBox">
      {rows.map((row, i) => (
      <div className="gridBoxRow" key={i} style={{"gap": gap, "marginTop": gap}}>
        {row.pad(stretch ? row.length : n, "").map((item, j) => (
          <div className={classNames({gridBoxItem: 1, placeholder: !item})} key={`gridItem|${j}`}>{item}</div>
        ))}
      </div>
      ))}
    </div>
  );
}

class TwoOrThreeBox extends Component {
  // Wrap a list of elements into a two or three column table, depending on window width
  render() {
      var threshhold = this.props.threshhold;
      if (this.props.width > threshhold) {
        return (<NBox content={this.props.content} n={3}/>);
      } else {
        return (<NBox content={this.props.content} n={2}/>);
      }
  }
}
TwoOrThreeBox.propTypes = {
  content:    PropTypes.array.isRequired,
  width:      PropTypes.number.isRequired,
  threshhold: PropTypes.number
};
TwoOrThreeBox.defaultProps = {
  threshhold: 500
};


const ResponsiveNBox = ({content, stretch, initialWidth, threshold2=500, threshold3=1500, gap=0}) => {
  //above threshold2, there will be 2 columns
  //above threshold3, there will be 3 columns
  initialWidth = initialWidth || (window ? window.innerWidth : 1000);
  const [width, setWidth] = useState(initialWidth);
  const ref = useRef(null);

  useEffect(() => {
    deriveAndSetWidth();
    window.addEventListener("resize", deriveAndSetWidth);
    return () => {
        window.removeEventListener("resize", deriveAndSetWidth);
    }
  }, []);

  const deriveAndSetWidth = () => setWidth(ref.current ? ref.current.offsetWidth : initialWidth);

  const n = (width > threshold3) ? 3 :
    (width > threshold2) ? 2 : 1;

  return (
    <div className="responsiveNBox" ref={ref}>
      <NBox content={content} n={n} stretch={stretch} gap={gap}/>
    </div>
  );
};


class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      optionsOpen: false,
      selected: null
    };
  }

  componentDidMount() {
    if (this.props.preselected) {
      const selected = this.props.options.filter( o => (o.value == this.props.preselected));
      this.select(selected[0])
    }
  }

  select(option) {
    this.setState({selected: option, optionsOpen: false});
    const event = {target: {name: this.props.name, value: option.value}}
    this.props.onChange && this.props.onChange(event);
  }
  toggle() {
    this.setState({optionsOpen: !this.state.optionsOpen});
  }
  render() {
    return (
        <div className="dropdown sans-serif">
          <div className={`dropdownMain noselect${this.state.selected ? " selected":""}`} onClick={this.toggle}>
            <span>{this.state.selected ? this.state.selected.label : this.props.placeholder}</span>
            <img src="/static/icons/chevron-down.svg" className="dropdownOpenButton noselect fa fa-caret-down"/>

          </div>
          {this.state.optionsOpen ?
            <div className="dropdownListBox noselect">
              <div className="dropdownList noselect">
                {this.props.options.map(function(option) {
                  const onClick = this.select.bind(null, option);
                  const classes = classNames({dropdownOption: 1, selected: this.state.selected && this.state.selected.value == option.value});
                  return <div className={classes} onClick={onClick} key={option.value}>{option.label}</div>
                }.bind(this))}
              </div>
            </div>
          : null}
        </div>);
  }
}
Dropdown.propTypes = {
  options:     PropTypes.array.isRequired, // Array of {label, value}
  name:        PropTypes.string.isRequired,
  onChange:    PropTypes.func,
  placeholder: PropTypes.string,
  selected:    PropTypes.string,
};


class LoadingMessage extends Component {
  render() {
    var message = this.props.message || "Loading...";
    var heMessage = this.props.heMessage || "טוען מידע...";
    var classes = "loadingMessage sans-serif " + (this.props.className || "");
    return (<div className={classes}>
              <InterfaceText>
                <EnglishText>{message}</EnglishText>
                <HebrewText>{heMessage}</HebrewText>
              </InterfaceText>
            </div>);
  }
}
LoadingMessage.propTypes = {
  message:   PropTypes.string,
  heMessage: PropTypes.string,
  className: PropTypes.string
};


const CategoryAttribution = ({categories, linked = true, asEdition}) => {
  const attribution = Sefaria.categoryAttribution(categories);
  if (!attribution) { return null; }

  const en = asEdition ? attribution.englishAsEdition : attribution.english;
  const he = asEdition ? attribution.hebrewAsEdition : attribution.hebrew;
  const str = <ContentText text={{en, he}} defaultToInterfaceOnBilingual={true} />;

  const content = linked ?
      <a href={attribution.link}>{str}</a> : str;

  return <div className="categoryAttribution">{content}</div>;
};


class SheetTopicLink extends Component {
  handleTagClick(e) {
    e.preventDefault();
    this.props.setSheetTag(this.props.topic.slug);
  }
  render() {
    const { slug, en, he } = this.props.topic;
    return (
      <a href={`/topics/${slug}`} onClick={this.handleTagClick}>
        <InterfaceText text={{en:en, he:he}} />
      </a>
    );
  }
}
SheetTopicLink.propTypes = {
  topic:       PropTypes.shape({
                 en: PropTypes.string.isRequired,
                 he: PropTypes.string.isRequired,
                 slug: PropTypes.string.isRequired,
               }).isRequired,
  setSheetTag: PropTypes.func.isRequired
};


class SheetAccessIcon extends Component {
  render() {
    var sheet = this.props.sheet;
    return (sheet.status == "unlisted") ?
      (<i className="fa fa-lock" title={msg}></i>)
      : null;
  }
}
SheetAccessIcon.propTypes = {
  sheet: PropTypes.object.isRequired
};


class FeedbackBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      type: null,
      alertmsg: null,
      feedbackSent: false,
    };
  }
  sendFeedback() {
    if (!this.state.type) {
      this.setState({alertmsg: Sefaria._("Please select a feedback type")});
      return
    }

    if (!Sefaria._uid && !this.validateEmail($("#feedbackEmail").val())) {
      this.setState({alertmsg: Sefaria._("Please enter a valid email address")});
      return
    }

    let feedback = {
        refs: this.props.srefs || null,
        type: this.state.type,
        url: this.props.url || null,
        currVersions: this.props.currVersions,
        email: $("#feedbackEmail").val() || null,
        msg: $("#feedbackText").val(),
        uid: Sefaria._uid || null
    };
    let postData = {json: JSON.stringify(feedback)};
    const url = "/api/send_feedback";

    this.setState({feedbackSent: true});

    $.post(url, postData, function (data) {
        if (data.error) {
            alert(data.error);
        } else {
            console.log(data);
            Sefaria.track.event("Tools", "Send Feedback", this.props.url);
        }
    }.bind(this)).fail(function (xhr, textStatus, errorThrown) {
        alert(Sefaria._("Unfortunately, there was an error sending this feedback. Please try again or try reloading this page."));
        this.setState({feedbackSent: true});
    });
  }
  validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }
  setType(event) {
    this.setState({type: event.target.value});
  }
  render() {
    if (this.state.feedbackSent) {
        return (
            <div className="feedbackBox sans-serif">
                <p className="int-en">Feedback sent!</p>
                <p className="int-he">משוב נשלח!</p>
            </div>
        )
    }
    return (
        <div className="feedbackBox sans-serif">
            <p className="int-en">Have some feedback? We would love to hear it.</p>
            <p className="int-he">אנחנו מעוניינים במשוב ממך</p>

            {this.state.alertmsg ?
                <div>
                    <p className="int-en">{this.state.alertmsg}</p>
                    <p className="int-he">{this.state.alertmsg}</p>
                </div>
                : null
            }

            <Dropdown
              name="feedbackType"
              options={[
                        {value: "content_issue",   label: Sefaria._("Report an issue with the text")},
                        {value: "translation_request",   label: Sefaria._("Request translation")},
                        {value: "bug_report",      label: Sefaria._("Report a bug")},
                        {value: "help_request",    label: Sefaria._("Get help")},
                        {value: "feature_request", label: Sefaria._("Request a feature")},
                        {value: "good_vibes",      label: Sefaria._("Give thanks")},
                        {value: "other",           label: Sefaria._("Other")},
                      ]}
              placeholder={Sefaria._("Select Type")}
              onChange={this.setType}
            />

            <textarea className="feedbackText" placeholder={Sefaria._("Describe the issue...")} id="feedbackText"></textarea>

            {!Sefaria._uid ?
                <div><input className="sidebarInput noselect" placeholder={Sefaria._("Email Address")} id="feedbackEmail" /></div>
                : null }

             <div className="button" role="button" onClick={() => this.sendFeedback()}>
                 <span className="int-en">Submit</span>
                 <span className="int-he">שליחה</span>
             </div>
        </div>
    );
  }
}


class ReaderMessage extends Component {
  // Component for determining user feedback on new element
  constructor(props) {
    super(props)
    var showNotification = Sefaria._inBrowser && !document.cookie.includes(this.props.messageName+"Accepted");
    this.state = {showNotification: showNotification};
  }
  setFeedback(status) {
    Sefaria.track.uiFeedback(this.props.messageName+"Accepted", status);
    $.cookie((this.props.messageName+"Accepted"), 1, {path: "/"});
    this.setState({showNotification: false});
  }
  render() {
    if (!this.state.showNotification) { return null; }
    return (
      <div className="readerMessageBox">
        <div className="readerMessage">
          <div className="int-en">{this.props.message}</div>
          <div className="button small" role="button" onClick={() => this.setFeedback('Like')}>{this.props.buttonLikeText}</div>
          <div className="button small" role="button" onClick={() => this.setFeedback('Dislike')}>{this.props.buttonDislikeText}</div>
        </div>
      </div>);
  }
}
ReaderMessage.propTypes = {
  messageName: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  buttonLikeText: PropTypes.string.isRequired,
  buttonDislikeText: PropTypes.string.isRequired,
};


class CookiesNotification extends Component {
  constructor(props) {
    super(props);
    const showNotification = /*!Sefaria._debug && */Sefaria._inBrowser && !document.cookie.includes("cookiesNotificationAccepted");

    this.state = {showNotification: showNotification};
  }
  setCookie() {
    $.cookie("cookiesNotificationAccepted", 1, {path: "/", expires: 20*365});
    this.setState({showNotification: false});
  }
  render() {
    if (!this.state.showNotification) { return null; }
    return (
      <div className="cookiesNotification">

          <span className="int-en">
            <span>We use cookies to give you the best experience possible on our site. Click OK to continue using Sefaria. <a href="/privacy-policy">Learn More</a>.</span>
            <span className='int-en button small white' onClick={this.setCookie}>OK</span>
          </span>
          <span className="int-he">
            <span>אנחנו משתמשים ב"עוגיות" כדי לתת למשתמשים את חוויית השימוש הטובה ביותר.
              <a href="/privacy-policy">קראו עוד בנושא</a>
            </span>
            <span className='int-he button small white' onClick={this.setCookie}>לחצו כאן לאישור</span>
          </span>

       </div>
    );
  }
}


const CommunityPagePreviewControls = ({date}) => {

  const dateStr = (date, offset) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset)

    return (
      (d.getMonth() + 1) + "/" +
      d.getDate() + "/" +
      d.getFullYear().toString().slice(2)
    );
  };

  const tomorrow = dateStr(date, 1);
  const yesterday = dateStr(date, -1)

  return (
    <div id="communityPagePreviewControls">
      <InterfaceText>You are previewing the Community page for </InterfaceText>
      <a className="date" href={"/admin/community-preview?date=" + date}>
        <InterfaceText>{date}</InterfaceText>
      </a>
      <div>
        <a href={"/admin/community-preview?date=" + yesterday}>
          <InterfaceText>{"« " + yesterday}</InterfaceText>
        </a>
        <a href={"/admin/community-preview?date=" + tomorrow}>
          <InterfaceText>{tomorrow + " »"}</InterfaceText>
        </a>
      </div>
      <div>
        <a href={"/admin/reset/community?next=" + date}>
          <InterfaceText>Refresh Cache</InterfaceText>
        </a>
      </div>
    </div>
  );
};


const SheetTitle = (props) => (
  <span className="title"
    role="heading"
    aria-level="1"
    contentEditable={props.editable}
    suppressContentEditableWarning={true}
    onBlur={props.editable ? props.blurCallback : null}
    style={{"direction": Sefaria.hebrew.isHebrew(props.title.stripHtml()) ? "rtl" :"ltr"}}
  >
  {props.title ? props.title.stripHtmlConvertLineBreaks() : ""}
  </span>
);
SheetTitle.propTypes = {
  title: PropTypes.string,
};


const SheetAuthorStatement = (props) => (
  <div className="authorStatement sans-serif" contentEditable={false} style={{ userSelect: 'none' }}>
    {props.children}
  </div>
);
SheetAuthorStatement.propTypes = {
  authorImage:      PropTypes.string,
  authorStatement:  PropTypes.string,
  authorUrl:        PropTypes.string,
};


const CollectionStatement = ({name, slug, image, children}) => (
  slug ?
    <div className="collectionStatement sans-serif" contentEditable={false} style={{ userSelect: 'none' }}>
      <div className="collectionListingImageBox imageBox">
        <a href={"/collections/" + slug}>
          <img className={classNames({collectionListingImage:1, "img-circle": 1, default: !image})} src={image || "/static/icons/collection.svg"} alt="Collection Logo"/>
        </a>
      </div>
      <a href={"/collections/" + slug}>{children ? children : name}</a>
    </div>
    :
    <div className="collectionStatement sans-serif" contentEditable={false} style={{ userSelect: 'none', display: 'none' }}>
      {children}
    </div>
);

const AdminToolHeader = function({title, validate, close}) {
  /*
  Save and Cancel buttons with a header using the `title` text.  Save button calls 'validate' and cancel button calls 'close'.
   */
  return    <div className="headerWithButtons">
              <h1 className="pageTitle">
                <InterfaceText>{title}</InterfaceText>
              </h1>
              <div className="end">
                <a onClick={close} id="cancel" className="button small transparent control-elem">
                  <InterfaceText>Cancel</InterfaceText>
                </a>
                <div onClick={validate} id="saveAccountSettings" className="button small blue control-elem" tabIndex="0" role="button">
                  <InterfaceText>Save</InterfaceText>
                </div>
              </div>
            </div>
}


const CategoryChooser = function({categories, update}) {
  /*
  Allows user to start from the top of the TOC and select a precise path through the category TOC using option menus.
  'categories' is initial list of categories specifying a path and 'update' is called with new categories after the user changes selection
   */
  const categoryMenu = useRef();

  const handleChange = function(e) {
    let newCategories = [];
    for (let i=0; i<categoryMenu.current.children.length; i++) {
      let el = categoryMenu.current.children[i].children[0];
      let elValue = el.options[el.selectedIndex].value;
      let possCategories = newCategories.concat([elValue]);
      if (!Sefaria.tocObjectByCategories(possCategories)) {
        // if possCategories are ["Talmud", "Prophets"], break out and leave newCategories as ["Talmud"]
        break;
      }
      newCategories.push(elValue);
    }
    update(newCategories); //tell parent of new values
  }

  let menus = [];

  //create a menu of first level categories
  let options = Sefaria.toc.map(function(child, key) {
    if (categories.length > 0 && categories[0] === child.category) {
      return <option key={key+1} value={categories[0]} selected>{categories[0]}</option>;
    }
    else {
      return <option key={key+1} value={child.category}>{child.category}</option>
    }
  });
  menus.push(options);

  //now add to menu second and/or third level categories found in categories
  for (let i=0; i<categories.length; i++) {
    let options = [];
    const tocObject = Sefaria.tocObjectByCategories(categories.slice(0, i+1));
    const subcats = !tocObject?.contents ? [] : tocObject.contents.filter(x => x.hasOwnProperty("category")); //Indices have 'categories' field and Categories have 'category' field which is their lastPath
    for (let j=0; j<subcats.length; j++) {
      const selected = categories.length >= i && categories[i+1] === subcats[j].category;
      options.push(<option key={j} value={subcats[j].category} selected={selected}>{subcats[j].category}</option>);
    }
    if (options.length > 0) {
      menus.push(options);
    }
  }
  return <div ref={categoryMenu}>
          {menus.map((menu, index) =>
            <div id="categoryChooserMenu">
              <select key={`subcats-${index}`} id={`subcats-${index}`} onChange={handleChange}>
              <option key="chooseCategory" value="Choose a category">Table of Contents</option>
              {menu}
              </select>
            </div>)}
         </div>
}


const TitleVariants = function({titles, update, options}) {
  /*
  Wrapper for ReactTags component.  `titles` is initial list of strings to populate ReactTags component
  and `update` is method to call after deleting or adding to titles. `options` is an object that can have
  the fields `onTitleDelete`, `onTitleAddition`, and `onTitleValidate` allowing overloading of TitleVariant's methods
   */
  const onTitleDelete = function(i) {
    const newTitles = titles.filter(t => t !== titles[i]);
    update(newTitles);
  }
  const onTitleAddition = function(title) {
    const newTitles = [].concat(titles, title);
    update(newTitles);
  }
  const onTitleValidate = function (title) {
    const validTitle = titles.every((item) => item.name !== title.name);
    if (!validTitle) {
      alert(title.name+" already exists.");
    }
    return validTitle;
  }

  return <div className="publishBox">
                <ReactTags
                    allowNew={true}
                    tags={titles}
                    onDelete={options?.onTitleDelete ? options.onTitleDelete : onTitleDelete}
                    placeholderText={Sefaria._("Add a title...")}
                    delimiters={["Enter", "Tab"]}
                    onAddition={options?.onTitleAddition ? options.onTitleAddition : onTitleAddition}
                    onValidate={options?.onTitleValidate ? options.onTitleValidate : onTitleValidate}
                  />
         </div>
}

const SheetMetaDataBox = (props) => (
  <div className="sheetMetaDataBox">
    {props.children}
  </div>
);

const DivineNameReplacer = ({setDivineNameReplacement, divineNameReplacement}) => {
  return (
      <div className="divineNameReplacer">
        <p className="sans-serif"><InterfaceText>Select how you would like to display the divine name in this sheet:</InterfaceText></p>

            <Dropdown
              name="divinename"
              options={[
                        {value: "noSub",   label: Sefaria._("No Substitution")},
                        {value: "yy",   label: 'יי'},
                        {value: "h",      label:'ה׳'},
                        {value: "ykvk",    label: 'יקוק'},
                      ]}
              placeholder={Sefaria._("Select Type")}
              onChange={(e) => setDivineNameReplacement((e.target.value))}
              preselected={divineNameReplacement}
            />
      </div>
  )

}
const Autocompleter = ({getSuggestions, showSuggestionsOnSelect, inputPlaceholder, inputValue, changeInputValue, selectedCallback,
                         buttonTitle, autocompleteClassNames }) => {
  /*
  Autocompleter component used in AddInterfaceInput and TopicSearch components.  Component contains an input box, a
  select menu that shows autcomplete suggestions, and a button.  To submit an autocomplete suggestion, user can press enter in the input box, or click on the button.
  `getSuggestions` is a callback function that is called whenever the user types in the input box, which causes the select menu to be populated.
  It returns an object with the necessary props of "currentSuggestions" and "showAddButton" and optional props "previewText" and "helperPromptText" (latter are used in Editor.jsx)
  `showSuggestionsOnSelect` is a boolean; if true, when the user selects an option from the suggestions,`getSuggestions` will be called. Useful when autocompleting a Ref in AddInterfaceInput.
  `inputPlaceholder` is the placeholder for the input component.
  `inputValue` and `changeInputValue` are passed from the parent so that when there is a change in the input box, the parent knows about it.  Useful in TopicSearch for the case "Create new topic: [new topic]"
  `selectedCallback` is a callback function called when the user submits an autocomplete suggestion.
  `autocompleteClassNames` are styling options
   */
  const [currentSuggestions, setCurrentSuggestions] = useState(null);
  const [previewText, setPreviewText] = useState(null);
  const [helperPromptText, setHelperPromptText] = useState(null);
  const [showAddButton, setShowAddButton] = useState(false);
  const [showCurrentSuggestions, setShowCurrentSuggestions] = useState(true);
  const [inputClassNames, setInputClassNames] = useState(classNames({selected: 0}));
  const suggestionEl = useRef(null);
  const inputEl = useRef(null);
  const buttonClassNames = classNames({button: 1, small: 1});

  const getWidthOfInput = () => {
    //Create a temporary div w/ all of the same styles as the input since we can't measure the input
    let tmp = document.createElement("div");
    const inputEl = document.querySelector('.addInterfaceInput input');
    const styles = window.getComputedStyle(inputEl);
    //Reduce function required b/c cssText returns "" on Firefox
    const cssText = Object.values(styles).reduce(
        (css, propertyName) =>
            `${css}${propertyName}:${styles.getPropertyValue(
                propertyName
            )};`
    );
    tmp.style.cssText = cssText

    //otherwise it will always return the width of container instead of the content
    tmp.style.removeProperty('width')
    tmp.style.removeProperty('min-width')
    tmp.style.removeProperty('min-inline-size')
    tmp.style.removeProperty('inline-size')

    tmp.innerHTML = inputEl.value.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.body.appendChild(tmp);
    const theWidth = tmp.getBoundingClientRect().width;
    document.body.removeChild(tmp);
    return theWidth;
  }

  useEffect(
    () => {
         const element = document.querySelector('.textPreviewSegment.highlight');
         if (element) {element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })}
    }, [previewText]
  )

  const resizeInputIfNeeded = () => {
    const currentWidth = getWidthOfInput();
    if (currentWidth > 350) {document.querySelector('.addInterfaceInput input').style.width = `${currentWidth+20}px`}
  }

  const processSuggestions = (resultsPromise) => {
    resultsPromise.then(results => {
      setCurrentSuggestions(results.currentSuggestions);
      setShowAddButton(results.showAddButton);
      setHelperPromptText(results.helperPromptText);
      if (!!results.previewText) {
        generatePreviewText(results.previewText);
      }
      if (!!results.helperPromptText) {
        document.querySelector('.addInterfaceInput input+span.helperCompletionText').style.insetInlineStart = `${getWidthOfInput()}px`;
      }
    });
  }

  const onChange = (input) => {
    setInputClassNames(classNames({selected: 0}));
    setShowCurrentSuggestions(true);
    processSuggestions(getSuggestions(input));
    resizeInputIfNeeded();
  }

  const handleOnClickSuggestion = (title) => {
      changeInputValue(title);
      setShowCurrentSuggestions(showSuggestionsOnSelect);
      if (showSuggestionsOnSelect) {
        processSuggestions(getSuggestions(title));
      }
      setInputClassNames(classNames({selected: 1}));
      resizeInputIfNeeded();
      inputEl.current.focus();
  }

  const Suggestion = ({title, color}) => {
    return(<option
              className="suggestion"
              onClick={(e)=>{
                  e.stopPropagation()
                  handleOnClickSuggestion(title)
                }
              }
              style={{"borderInlineStartColor": color}}
           >{title}</option>)

  }
  const mapSuggestions = (suggestions) => {
    const div = suggestions.map((suggestion, index) => (

        (<Suggestion
           title={suggestion.name}
           color={suggestion.border_color}
           key={index}
        />)

    ))

  return(div)
  }

  const handleSelection = () => {
    selectedCallback(inputValue, currentSuggestions);
    setPreviewText(null);
    setShowAddButton(false);
  }

  const onKeyDown = e => {
    if (e.key === 'Enter' && showAddButton) {
      handleSelection(inputValue, currentSuggestions);
    }

    else if (e.key === 'ArrowDown' && currentSuggestions && currentSuggestions.length > 0) {
      suggestionEl.current.focus();
      (suggestionEl.current).firstChild.selected = 'selected';
    }
    else
    {
      changeInputValue(inputEl.current.value);
    }
  }


  const generatePreviewText = (ref) => {
        Sefaria.getText(ref, {context:1, stripItags: 1}).then(text => {
           const segments = Sefaria.makeSegments(text, true);
           const previewHTML =  segments.map((segment, i) => {
            {
              const heOnly = !segment.en;
              const enOnly = !segment.he;
              const overrideLanguage = (enOnly || heOnly) ? (heOnly ? "hebrew" : "english") : null;

              return(
                  <div
                      className={classNames({'textPreviewSegment': 1, highlight: segment.highlight, heOnly: heOnly, enOnly: enOnly})}
                      key={segment.ref}>
                    <sup><ContentText
                        text={{"en": segment.number, "he": Sefaria.hebrew.encodeHebrewNumeral(segment.number)}}
                        defaultToInterfaceOnBilingual={true}
                    /></sup> <ContentText html={{"he": segment.he+ " ", "en": segment.en+ " " }} defaultToInterfaceOnBilingual={!overrideLanguage} overrideLanguage={overrideLanguage} bilingualOrder={["en", "he"]}/>
                  </div>
              )
            }
          })
          setPreviewText(previewHTML);
        })
  }

   const checkEnterOnSelect = (e) => {
      if (e.key === 'Enter') {
          handleOnClickSuggestion(e.target.value);
      }
    }

  return(
    <div className={autocompleteClassNames} onClick={(e) => {e.stopPropagation()}} title={Sefaria._(buttonTitle)}>
      <input
          type="text"
          placeholder={Sefaria._(inputPlaceholder)}
          onKeyDown={(e) => onKeyDown(e)}
          onClick={(e) => {e.stopPropagation()}}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => setPreviewText(null) }
          value={inputValue}
          ref={inputEl}
          className={inputClassNames}

      /><span className="helperCompletionText sans-serif-in-hebrew">{helperPromptText}</span>
      {showAddButton ? <button className={buttonClassNames} onClick={(e) => {
                    handleSelection(inputValue, currentSuggestions)
                }}>{buttonTitle}</button> : null}

      {showCurrentSuggestions && currentSuggestions && currentSuggestions.length > 0 ?
          <div className="suggestionBoxContainer">
          <select
              ref={suggestionEl}
              className="suggestionBox"
              size={currentSuggestions.length}
              multiple
              onKeyDown={(e) => checkEnterOnSelect(e)}
          >
            {mapSuggestions(currentSuggestions)}
          </select>
          </div>
          : null
      }

      {previewText ?
          <div className="textPreviewContainer">
            <div className="textPreview">
              <div className="inner">{previewText}</div>
            </div>
          </div>

          : null

      }

    </div>
    )
}
export {
  CategoryHeader,
  SimpleInterfaceBlock,
  DangerousInterfaceBlock,
  SimpleContentBlock,
  SimpleLinkedBlock,
  BlockLink,
  CategoryColorLine,
  CategoryAttribution,
  CollectionStatement,
  CookiesNotification,
  CollectionListing,
  ColorBarBox,
  Dropdown,
  DropdownButton,
  DropdownModal,
  DropdownOptionList,
  FeedbackBox,
  FilterableList,
  FollowButton,
  GlobalWarningMessage,
  InterruptingMessage,
  InterfaceText,
  ContentText,
  EnglishText,
  HebrewText,
  CommunityPagePreviewControls,
  LanguageToggleButton,
  Link,
  LoadingMessage,
  LoadingRing,
  LoginPrompt,
  MessageModal,
  NBox,
  NewsletterSignUpForm,
  Note,
  ProfileListing,
  ProfilePic,
  ReaderMessage,
  CloseButton,
  DisplaySettingsButton,
  MenuButton,
  SearchButton,
  SaveButton,
  SignUpModal,
  SheetListing,
  SheetAccessIcon,
  SheetTopicLink,
  TabView,
  TextBlockLink,
  ToggleSet,
  ToolTipped,
  TwoOrThreeBox,
  ResponsiveNBox,
  SheetMetaDataBox,
  SheetAuthorStatement,
  SheetTitle,
  InterfaceLanguageMenu,
  Autocompleter,
  DonateLink,
  DivineNameReplacer,
  AdminToolHeader,
  CategoryChooser,
  TitleVariants,
  requestWithCallBack
};
