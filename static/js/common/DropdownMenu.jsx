import React, {useEffect, useRef, useState} from 'react';
import PropTypes from "prop-types";
import { InterfaceText } from '../Misc';

const DropdownMenuSeparator = () => {

  return (
    <div className='dropdownSeparator'></div>
  );

}

const DropdownMenuItem = ({url, children, newTab, preventClose = false}) => {
  const dropDownClasses = `interfaceLinks-option int-bi dropdownItem`;
  if (!url) {
      return (
          <div className={dropDownClasses}>
              {children}
          </div>
      );
  }

  if (!newTab){
    newTab = false;
  }

  return (
    <a className={dropDownClasses}
       href={url}
       target={newTab ? '_blank' : null}
       data-prevent-close={preventClose}>
      {children}
    </a>

  );
}

const DropdownMenuItemWithIcon = ({icon, textEn, textHe, onClick, descEn='',
                                  descHe=''}) => {
  return (
    <>
      <div className="dropdownHeader" onClick={() => onClick()}>
        <img src={icon} />
        <span className='dropdownHeaderText'>
          <InterfaceText text={{'en': textEn, 'he': textHe}} />
        </span>
      </div>
      <div className='dropdownDesc'>
        <InterfaceText text={{'en': descEn, 'he': descHe}} />
      </div>
  </>
  );
}

const DropdownMenu = ({children, buttonComponent, positioningClass}) => {
    /**
     * `buttonComponent` is a React component for the opening/closing of a button.
     * `positioningClass` is a string for the positioning of the dropdown menu.  It defines a CSS class.
     *  Currently, we have two possible classes: 'headerDropdownMenu' and 'readerDropdownMenu'.
     *  The former is a more general case.  Historically, the former was used in the header
     *  and the latter in the reader.  See s2.css for definition of these classes.
     * the menu will be closed in click anywhere except in an element where data attribute data-prevent-close="true" is set.
     * this class is using useRef for open/close rather than useState, for changing state triggers re-rendering of the
     * component and all its children, so when clicking on children their onClick won't be executed.
     */

    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const handleButtonClick = (e) => {
      e.stopPropagation();
      setIsOpen(isOpen => !isOpen);
    };
    const handleContentsClick = (e) => {
      e.stopPropagation();
      const preventClose = e.target.closest('[data-prevent-close="true"]');
      // Only toggle if no preventClose element was found
      if (!preventClose) {
        setIsOpen(false);
      }
    }
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
        <div className={positioningClass} ref={wrapperRef}>
           <div className="dropdownLinks-button" onClick={handleButtonClick}>
              {buttonComponent}
          </div>
          <div className={`dropdownLinks-menu ${ isOpen ? "open" : "closed"}`} onClick={handleContentsClick}>
              {children}
          </div>
        </div>
    );
  }

  DropdownMenu.propTypes = {
    buttonComponent: PropTypes.element.isRequired,
  };
  export {
    DropdownMenu, 
    DropdownMenuSeparator, 
    DropdownMenuItemWithIcon,
    DropdownMenuItem
  };