import React, { useState } from 'react';
import './App.css';
import icon from './media/icon.png';
import Content from './Content'

function App() {
  const [content, setContent] = useState('home');

  function changeContent(newContent) {
    console.log(newContent);
    setContent(newContent);
  }

  return (
    <div className="App">
      <header>
        <div className='header-content'>
          <img className='logo' src={icon} alt='logo' onClick={() => changeContent('home')}></img>
          <button onClick={() => changeContent('portfolio')}>&gt; portfolio</button>
          <button onClick={() => changeContent('media')}>&gt; media</button>
          <button onClick={() => changeContent('contact')}>&gt; contact</button>
        </div>
      </header>
      <div className='content-wrapper'>
        <Content page={content}/>
      </div>
    </div>
  );
}

export default App;
