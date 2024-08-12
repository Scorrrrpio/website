import History from './History'
import React, { useRef, useState } from 'react';

export default function Terminal() {
    const terminal = useRef();
    const [history, setHistory] = useState([]);

    function handleSubmit(e) {
        console.log(terminal);
        e.preventDefault();
        const submission = terminal.current.value;
        if (submission === 'clear') {
            setHistory([]);
        }
        else {
            setHistory([...history, submission]);
        }
        terminal.current.value = null;
        terminal.current.scrollIntoView();
    }

    return (
        <ul>
            <li>welcome to my portfolio</li>
            <li>try 'commands'</li>
            <History history={history}/>
            <li>
                <form onSubmit={e => handleSubmit(e)}>
                    {/*e.preventDefault(); setCount(count + 1)*/}
                    {/*<input type='text' placeholder='_' ref={ref => ref && ref.focus()}></input>*/}
                    <input type='text' placeholder='_' ref={terminal}></input>
                    <button></button>
                </form>
            </li>
        </ul>
    );
}