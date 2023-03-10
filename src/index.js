import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import "react-alice-carousel/lib/alice-carousel.css";
import Keycloak from "keycloak-js";
import {config} from "./Constants";
import { ReactKeycloakProvider } from '@react-keycloak/web'
import {HashLoader} from "react-spinners";
import {uberAPI} from "./components/misc/UberAPI";
import { ChakraProvider, theme } from '@chakra-ui/react'
import DataContextProvider from "./components/misc/Balance";



const initOptions = { pkceMethod: 'S256' }

const keycloak = new Keycloak({
    url: `${config.url.KEYCLOAK_BASE_URL}`,
    realm: "uber-services",
    clientId: "uber-app"
})

const loadingComponent = (
    <div style={
        {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)"
        }
    }>
        <HashLoader
            type={"spinningBubbles"}
            color={"#123abc"}
            height={100}
            width={100}
        />
    </div>
)
const handleOnEvent = async (event, error) => {
    if (event === 'onAuthSuccess') {
        if (keycloak.authenticated) {
            let response = await uberAPI.getUserExtrasMe(keycloak.token)
            if (response.status === 404) {
                const userExtra = { avatar: keycloak.tokenParsed.preferred_username }
                response = await uberAPI.saveUserExtrasMe(keycloak.token, userExtra)
            }
            keycloak['avatar'] = response.data.avatar
        }
    }
}


ReactDOM.render(
    <React.StrictMode>
        <ChakraProvider theme={theme}>
        <ReactKeycloakProvider
            authClient={keycloak}
            initOptions={initOptions}
            LoadingComponent={loadingComponent}
            onEvent={(event, error) => handleOnEvent(event, error)}
        >
        <DataContextProvider>
        <App />
        </DataContextProvider>
        </ReactKeycloakProvider>
        </ChakraProvider>
    </React.StrictMode>,
    document.getElementById("root")
);
