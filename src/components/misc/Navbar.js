import React, {useContext, useEffect, useState} from 'react'
import { useKeycloak } from '@react-keycloak/web'
import { NavLink, withRouter } from 'react-router-dom'
import { Container, Dropdown, Menu } from 'semantic-ui-react'
import {getUsername, isCustomer, isDriver} from './Helpers'
import {uberAPI} from "./UberAPI";
import {DataContext} from "./Balance";

function Navbar(props) {

  const { keycloak } = useKeycloak()
  const {balance} = useContext(DataContext)


  const handleLogInOut = () => {
    if (keycloak.authenticated) {
      props.history.push('/')
      keycloak.logout()
    } else {
      keycloak.login()
    }
  }

  const fetchBalance = async () => {
    if(keycloak.authenticated) {
      await uberAPI.getUserBalance(getUsername(keycloak), keycloak.token).then((response) => {
        localStorage.setItem('balance', response.data)
      })
    }
  }

  useEffect(() => {
    fetchBalance().then()
  }, [])

  const checkAuthenticated = () => {
    if (!keycloak.authenticated) {
      handleLogInOut()
      return false;
    }
    return true;
  }

  const getUserLoggedInStyle = () => {
    return keycloak.authenticated ? { "display": "block" ,
      "float": "right",
      "color": "green",
      "margin-left": "10px",
      "margin-right": "10px",
    } : { "display": "none" }
  }


  const getLogInOutText = () => {
    return keycloak.authenticated ? "Logout" : "Login"
  }


  return (
    <Menu stackable>
      <Container>
          <Menu.Item header>UBER
          </Menu.Item>
        <Menu.Item as={NavLink} exact to="/">Home</Menu.Item>
        {checkAuthenticated() && isCustomer(keycloak) && <Menu.Item as={NavLink} exact to="/customer">Call Taxi </Menu.Item>}
        {checkAuthenticated() && isCustomer(keycloak) && <Menu.Item>
            <span onClick={() => getUserLoggedInStyle()}>
             💰 Balance: {balance ? balance : ""} ₺
            </span>
        </Menu.Item>}
        {checkAuthenticated() && isDriver(keycloak) && <Menu.Item as={NavLink} exact to="/driver">Driver</Menu.Item>}
        {checkAuthenticated() && isDriver(keycloak) && <Menu.Item>
            <span onClick={() => getUserLoggedInStyle()}>
             💰 Balance: {balance ? balance : ""} ₺
            </span>
        </Menu.Item>}
        <Menu.Menu position='right'>
          {keycloak.authenticated &&
            <Dropdown text={`Hi ${getUsername(keycloak)} `} pointing className='link item'>
              <Dropdown.Menu>
                {/*<Dropdown.Item as={NavLink} to="/settings">Settings</Dropdown.Item>*/}
                <Dropdown.Item as={NavLink} exact to="/settings" onClick={checkAuthenticated}>User Information</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          }
          <Menu.Item as={NavLink} exact to="/login" onClick={handleLogInOut}>{getLogInOutText()}</Menu.Item>
        </Menu.Menu>
      </Container>
    </Menu >
  )
}

export default withRouter(Navbar)