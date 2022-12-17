import axios from 'axios'
import { config } from '../../Constants'

export const uberAPI = {
  getUserExtrasMe,
  saveUserExtrasMe,
  getDefaultDataInformation,
  getDriverList,
  callTaxi,
  acceptCustomer,
  getCustomerStatus,
  getDriverStatus,
  getUserBalance,
  declineCustomer
}

function declineCustomer(id,mail,token){
  return instanceDriverApi.post(`/api/driver/command/reject/${id}`,{},{
    headers: {
      'Authorization': bearerAuth(token)
    }
  })
}

function getUserBalance(mail,token) {
  return instancePaymentApi.get(`/api/balance/query/balance/${mail}`, {
    headers: {
      'Content-type': 'application/json',
      'Authorization': bearerAuth(token)
    }
  })
}

function getDriverStatus(mail,token){
return instanceDriverApi.get(`/api/driver/query/status/${mail}`,{
    headers: {
      'Content-type': 'application/json',
      'Authorization': bearerAuth(token)
    }
  })
}


function getCustomerStatus(mail,ip,token){
    return instanceCustomerApi.get(`/api/customer/query/${mail}?ip=${ip}`, {
        headers: {
        'Content-type': 'application/json',
        'Authorization': bearerAuth(token)
        }
    })
}

function acceptCustomer(id,token){
  return instanceDriverApi.post(`/api/driver/command/accept/${id}`,{},{
    headers: {
      'Authorization': bearerAuth(token)
    }
  })
}


function callTaxi(request,mail,token){
  return instanceCustomerApi.post(`api/customer/command/call`, request, {
    headers: {
      'Content-type': 'application/json',
      'Authorization': bearerAuth(token)
    }
  })
}

function getDefaultDataInformation() {
  return instanceDriverApi.get(`https://geolocation-db.com/json/`)
}

function getDriverList(ip,disc,token) {
  return instanceDriverApi.get(`/api/driver/query/list/${ip}?distance=${disc}`, {
    headers: {
        'Content-type': 'application/json',
        'Authorization': bearerAuth(token)
    }
  })
}



function getUserExtrasMe(token) {
  return instanceCustomerApi.get(`/api/userextras/me`, {
    headers: {
      'Content-type': 'application/json',
      'Authorization': bearerAuth(token)
    }
  })
}

function saveUserExtrasMe(token, userExtra) {
  return instanceCustomerApi.post(`/api/userextras/me`, userExtra, {
    headers: {
      'Content-type': 'application/json',
      'Authorization': bearerAuth(token)
    }
  })
}

// -- Axios

const instanceDriverApi = axios.create({
  baseURL: "http://localhost:4768/"
})

const instancePaymentApi = axios.create({
  baseURL: "http://localhost:3131/"
})


const instanceCustomerApi = axios.create({
  baseURL: config.url.API_BASE_URL
})

instanceDriverApi.interceptors.response.use(response => {
  return response;
}, function (error) {
  if (error.response.status === 404) {
    return { status: error.response.status };
  }
  return Promise.reject(error.response);
});

instanceCustomerApi.interceptors.response.use(response => {
  return response;
}, function (error) {
  if (error.response.status === 404) {
    return { status: error.response.status };
  }
  return Promise.reject(error.response);
});

instancePaymentApi.interceptors.response.use(response => {
  return response;
}, function (error) {
  if (error.response.status === 404) {
    return { status: error.response.status };
  }
  return Promise.reject(error.response);
});
// -- Helper functions

function bearerAuth(token) {
  return `Bearer ${token}`
}