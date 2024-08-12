import React from 'react'

export default function render({history}) {
    class Clock extends React.Component {
        constructor(props) {
            super(props);
            this.state = {
                one: new Date()
            };
        }
    
        componentDidMount() {
            this.timerID = setInterval(
                () => this.tick(), 1000
            );
        }
    
        componentWillUnmount() {
            clearInterval(this.timerID);
        }
    
        tick() {
            this.setState({
                one: new Date()
            });
        }
        render() {
            return (
                <>{this.state.one.toLocaleTimeString()}</>
            );
        }
    }

    class Item extends React.Component {
        render() {
            if (this.props.name === 'commands') {
                return <li>
                    {this.props.name}<br/>
                    - Commands -<br/>
                    pwd | echo | time | clear
                    </li>
            }
            else if (this.props.name === 'pwd') {
                return <li>{this.props.name}<br/>/home/scorpio</li>
            }
            else if (this.props.name.substring(0, 4) === 'echo') {
                if (this.props.name.substring(0, 5) === 'echo ' && this.props.name.length > 5) {
                    return <li>{this.props.name}<br/>{this.props.name.substring(5)}</li>
                }
                else {
                    return <li>{this.props.name}</li>
                }
            }
            else if (this.props.name === 'time') {
                return <li>{this.props.name}<br/><Clock /></li>
            }
            else {
                return <li>{this.props.name}</li>
            }
        }
    }

    return (
        history.map((item) => {
            return <Item name={item} key={item}/>
        })
    );
}