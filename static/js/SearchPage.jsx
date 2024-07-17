import React  from 'react';
import ReactDOM  from 'react-dom';
import $  from './sefaria/sefariaJquery';
import Sefaria  from './sefaria/sefaria';
import classNames  from 'classnames';
import PropTypes  from 'prop-types';
import Footer  from './Footer';
import ComparePanelHeader from './ComparePanelHeader';
import SearchFilters from './SearchFilters';
import Component from 'react-class';
import {
  CategoryColorLine,
  InterfaceText,
  LoadingMessage,
} from './Misc';
import {SearchResultList} from "./SearchResultList";

class SearchPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      totalResults: null,
      mobileFiltersOpen: false,
    };
  }
  render () {
    const classes        = classNames({readerNavMenu: 1, compare: this.props.compare});
    const isQueryHebrew  = Sefaria.hebrew.isHebrew(this.props.query);
    const searchResultList = <SearchResultList
                                        query={this.props.query}
                                        hits={this.props.hits}
                                        type={this.props.type}
                                        compare={this.props.compare}
                                        searchState={this.props.searchState}
                                        onResultClick={this.props.onResultClick}
                                        updateAppliedOptionSort={this.props.updateAppliedOptionSort}
                                        registerAvailableFilters={this.props.registerAvailableFilters}
                                        openMobileFilters={() => this.setState({mobileFiltersOpen: true})}
                                        loadNextPage={this.props.loadNextPage}
                                        isQueryRunning={this.props.isQueryRunning}
                                        moreToLoad={this.props.moreToLoad}
                                        topics={this.props.topics}
                                      />;
    if (this.props.searchInBook) {
      return searchResultList;
    }
    return (
      <div className={classes} key={this.props.query}>
        {this.props.compare ?
        <ComparePanelHeader
          search={true}
          showDisplaySettings={false}
          onBack={this.props.close}
          openSearch={this.props.onQueryChange} /> : null}

        <div className="content searchContent">
          <div className="sidebarLayout">
            <div className="contentInner">
              
              <div className="searchTopLine">
                <h1 className={classNames({"hebrewQuery": isQueryHebrew, "englishQuery": !isQueryHebrew})}>
                  <InterfaceText>{this.props.searchTopMsg}</InterfaceText>&nbsp;
                  <InterfaceText html={{en: "&ldquo;", he: "&#1524;"}} />
                  { this.props.query }
                  <InterfaceText html={{en: "&rdquo;", he: "&#1524;"}} />
                </h1>
                {this.props.totalResults?.getValue() > 0 ?
                <div className="searchResultCount sans-serif">
                  <InterfaceText>{this.props.totalResults.asString()}</InterfaceText>&nbsp;
                  <InterfaceText>Results</InterfaceText>
                </div>
                : null }
              </div>

              {searchResultList}
            </div>

            {(Sefaria.multiPanel && !this.props.compare) || this.state.mobileFiltersOpen ?
            <div className={Sefaria.multiPanel && !this.props.compare ? "navSidebar" : "mobileSearchFilters"}>
              {this.props.totalResults?.getValue() > 0 ?
              <SearchFilters
                query={this.props.query}
                searchState={this.props.searchState}
                updateAppliedFilter={this.props.updateAppliedFilter.bind(null, this.props.type, this.props.searchState)}
                updateAppliedOptionField={this.props.updateAppliedOptionField.bind(null, this.props.type)}
                updateAppliedOptionSort={this.props.updateAppliedOptionSort.bind(null, this.props.type)}
                closeMobileFilters={() => this.setState({mobileFiltersOpen: false})}
                compare={this.props.compare}
                type={this.props.type} />
              : null }
            </div>
            : null }
          </div>
          { this.props.panelsOpen === 1 ? <Footer /> : null }
        </div>
      </div>
    );
  }
}
SearchPage.propTypes = {
  query:                    PropTypes.string,
  type:                      PropTypes.oneOf(["text", "sheet"]),
  searchState:              PropTypes.object,
  settings:                 PropTypes.object,
  panelsOpen:               PropTypes.number,
  close:                    PropTypes.func,
  onResultClick:            PropTypes.func,
  onQueryChange:            PropTypes.func,
  updateAppliedFilter:      PropTypes.func,
  updateAppliedOptionField: PropTypes.func,
  updateAppliedOptionSort:  PropTypes.func,
  registerAvailableFilters: PropTypes.func,
  loadNextPage:             PropTypes.func,
  moreToLoad:               PropTypes.bool,
  topics:                   PropTypes.array,
  totalResults:             PropTypes.object,
};


export default SearchPage;