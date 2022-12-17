const prod = {
  url: {
    KEYCLOAK_BASE_URL: "http://localhost:8080/",
    API_BASE_URL: 'https://bist-finance-app.herokuapp.com/',
    AVATARS_DICEBEAR_URL: 'https://avatars.dicebear.com/api'

  }
}

const dev = {
  url: {
    KEYCLOAK_BASE_URL: "http://localhost:8080",
    API_BASE_URL: 'http://localhost:9090/',
    AVATARS_DICEBEAR_URL: 'https://avatars.dicebear.com/api'
  }
}

export const config = process.env.NODE_ENV === 'development' ? dev : prod
