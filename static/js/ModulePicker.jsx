import React, { useState, useEffect } from 'react';

const ListItem = ({ color, title, url }) => {
  const dotStyle = {
    borderRadius: '250px',
    background: color,
    width: '10px',
    height: '10px',
    marginLeft: '25px',
    marginRight: '15px', // space between the dot and the text
  };

  const textStyle = {
    color: '#000',
    fontFamily: 'Roboto',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 'normal',
  };

  const listItemStyle = {
    display: 'flex',
    alignItems: 'center', // to align the dot and the text vertically
    cursor: 'pointer',
  };

  const goToUrl = () => {
    window.location.href = url;
};

  return (
    <div style={listItemStyle}>
        <div style={dotStyle}></div>
        <p style={textStyle}><a onClick={goToUrl}>{title}</a></p>
    </div>
  )
};

const ModulePickerComponent = () => {
    const [isOpen, setIsOpen] = useState(false);

    const togglePopover = () => {
      setIsOpen(!isOpen);
    };
  
    const closePopover = (event) => {
      if (!event.target.closest('.popover')) {
        setIsOpen(false);
      }
    };
  
    useEffect(() => {
      document.addEventListener('click', closePopover);
  
      return () => {
        document.removeEventListener('click', closePopover);
      };
    }, []);

  const popoverStyle = {
    position: 'absolute',
    padding: '10px',
    borderRadius: '6px',
    background: '#FFF',
    boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.25)',
    right: '20px', // to make the menu float left
    width: '170px',
    marginTop: '12px',
  };

  const buttonStyle = {
    marginLeft: '15px',
    marginTop: '5px',
    cursor: 'pointer',
  };

  const listItems = [
    { color: "#18345D", title: "Library", url: "https://library.cauldron.sefaria.org/" },
    { color: "#5D956F", title: "Create", url: "https://community.cauldron.sefaria.org/" },
    { color: "#CCB479", title: "Developers", url: "about:blank" },
  ];

  return (
    <div className="popover">
      <svg style={buttonStyle} onClick={togglePopover} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 2.5C5 3.88071 3.88071 5 2.5 5C1.11929 5 0 3.88071 0 2.5C0 1.11929 1.11929 0 2.5 0C3.88071 0 5 1.11929 5 2.5ZM12.5 2.5C12.5 1.11929 11.3807 0 10 0C8.61929 0 7.5 1.11929 7.5 2.5C7.5 3.88071 8.61929 5 10 5C11.3807 5 12.5 3.88071 12.5 2.5ZM20 2.5C20 1.11929 18.8807 0 17.5 0C16.1193 0 15 1.11929 15 2.5C15 3.88071 16.1193 5 17.5 5C18.8807 5 20 3.88071 20 2.5ZM5 10C5 8.61929 3.88071 7.5 2.5 7.5C1.11929 7.5 0 8.61929 0 10C0 11.3807 1.11929 12.5 2.5 12.5C3.88071 12.5 5 11.3807 5 10ZM12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5C11.3807 12.5 12.5 11.3807 12.5 10ZM20 10C20 8.61929 18.8807 7.5 17.5 7.5C16.1193 7.5 15 8.61929 15 10C15 11.3807 16.1193 12.5 17.5 12.5C18.8807 12.5 20 11.3807 20 10ZM5 17.5C5 16.1193 3.88071 15 2.5 15C1.11929 15 0 16.1193 0 17.5C0 18.8807 1.11929 20 2.5 20C3.88071 20 5 18.8807 5 17.5ZM12.5 17.5C12.5 16.1193 11.3807 15 10 15C8.61929 15 7.5 16.1193 7.5 17.5C7.5 18.8807 8.61929 20 10 20C11.3807 20 12.5 18.8807 12.5 17.5ZM20 17.5C20 16.1193 18.8807 15 17.5 15C16.1193 15 15 16.1193 15 17.5C15 18.8807 16.1193 20 17.5 20C18.8807 20 20 18.8807 20 17.5Z" fill="#666666"/>
      </svg>
      {isOpen && (
        <div style={popoverStyle}>
            {listItems.map((item, index) => (
                <ListItem key={index} color={item.color} title={item.title} url={item.url} />
            ))}
        </div>
      )}
    </div>
  );
};

export default ModulePickerComponent;
