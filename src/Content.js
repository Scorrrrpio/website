import React from 'react';
import Terminal from './Terminal'

export default function render(props) {
    if (props.page === 'portfolio') {
        return (
            <div id='main' className='content'>
                <h1>portfolio</h1>
            </div>
        );
    }
    else if (props.page === 'media') {
        return (
            <div id='main' className='content'>
                <h1>media</h1>
            </div>
        );
    }
    else if (props.page === 'contact') {
        return (
            <div id='main' className='content'>
                <h1>contact</h1>
            </div>
        );
    }
    else {
        return (
            <div id='main' className='content'>
                <h1>adrian koziskie</h1>
                <Terminal />
            </div>
        );
    }
}