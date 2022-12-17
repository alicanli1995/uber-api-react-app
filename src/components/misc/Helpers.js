import { config } from '../../Constants'

export const getAvatarUrl = (text) => {
  return `${config.url.AVATARS_DICEBEAR_URL}/avataaars/${text}.svg`
}

export const isCustomer = (keycloak) => {
  return keycloak &&
         keycloak.tokenParsed &&
         keycloak.tokenParsed.resource_access['uber-app'] &&
         keycloak.tokenParsed.resource_access['uber-app'].roles.includes('CUSTOMER') &&
         !keycloak.tokenParsed.resource_access['uber-app'].roles.includes('DRIVER')
}

export const isDriver = (keycloak) => {
    return keycloak &&
             keycloak.tokenParsed &&
             keycloak.tokenParsed.resource_access['uber-app'] &&
             keycloak.tokenParsed.resource_access['uber-app'].roles.includes('DRIVER')

}

export const getUsername = (keycloak) => {
  return keycloak.tokenParsed.email;
}


export const handleLogError = (error) => {
  if (error.response) {
    console.log(error.response.data);
  } else if (error.request) {
    console.log(error.request);
  } else {
    console.log(error.message);
  }
}