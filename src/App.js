import React from 'react'
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom'
import Home from './components/home/Home'
import Navbar from './components/misc/Navbar'
import Footer from './components/footer/Footer';
import PrivateRoute from "./components/misc/PrivateRoute";
import UserSettings from "./components/settings/UserSettings";
import MainMap from "./components/map/MainMap";
import DriverPage from "./components/driver/DriverPage";

function App() {

  return (
      <Router>
        <Navbar />
        <Switch>
          <div >
            <Route path="/" component={Home} exact />
            <PrivateRoute path="/customer" component={MainMap}/>
            <PrivateRoute path="/driver" component={DriverPage} />
            <PrivateRoute path="/settings" component={UserSettings} />
          </div>
        </Switch>
        {/*<Footer />*/}
      </Router>
  )
}

export default App