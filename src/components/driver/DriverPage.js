import React, {useEffect, useState} from "react";
import {
    Box, Button, ButtonGroup,
    Flex,
    HStack,
    SkeletonText,
    Text,
} from '@chakra-ui/react'
import {
    useJsApiLoader,
    GoogleMap, Marker, InfoWindow, DirectionsRenderer,
} from '@react-google-maps/api'
import {Image, Table} from 'semantic-ui-react'
import {uberAPI as uberApi} from "../misc/UberAPI";
import {useKeycloak,withKeycloak} from "@react-keycloak/web";
import {withRouter} from "react-router-dom";
import {getUsername} from "../misc/Helpers";
import useWebSocket from "react-use-websocket";


function DriverPage(){
    const [directionsResponse, setDirectionsResponse] = useState(null)
    const [distance, setDistance] = useState('')
    const [duration, setDuration] = useState('')
    const [destination, setDestination] = useState(null)
    const [center, setCenter] = useState({lat: 41.0479, lng: 28.9773 })
    const [acceptCall, setAcceptCall] = useState(false)
    const [ip, setIp] = useState('37.130.123.93')
    const [customers, setCustomers] = useState([]);
    const [focusCustomer, setFocusCustomer] = useState(null);
    const height = window.innerHeight - 200
    const [map, setMap] = useState( null)
    const { keycloak } = useKeycloak();
    const style = {
        marginTop: '-60rem',
        height: height,
        width: "43%",
        maxHeight: height,
        marginLeft: '-75rem',
        overflowY: 'auto',
        overflowX: 'hidden'
    }
    const WEBSOCKET_URL = 'ws://localhost:9090/customer';
    const [socketUrl, setSocketUrl] = useState(WEBSOCKET_URL);
    const [messageHistory, setMessageHistory] = useState([]);
    const {
        sendMessage,
        lastMessage,
        readyState,
    } = useWebSocket(socketUrl);

    useEffect(() => {
        if (lastMessage !== null) {
            console.log(lastMessage.data)
            let data = JSON.parse(lastMessage.data)
            if(data.dataType === 'CUSTOMER' && getUsername(keycloak) === data.driverMail) {
                console.log(data)
                setMessageHistory([...messageHistory, lastMessage.data]);
                const reqId = data.callDTO ? data.callDTO.requestId : data.requestId;
                if(reqId === focusCustomer &&
                    data.driverMail === getUsername(keycloak)
                    && data.customerMail === customers.find(c => c.requestId === focusCustomer).customerEmail){
                    setAcceptCall(false)
                    setFocusCustomer(null)
                    setCustomers([])
                    clearRoute();
                    return;
                }
                if (data.driverStatus === 'AVAILABLE') {
                    return;
                }
                setCustomers([...customers, data.callDTO])
                calculateRoute(data.callDTO)
            }
        }
    }, [lastMessage, setMessageHistory]);

    const getData = async () => {
        const res = await uberApi.getDefaultDataInformation();
        // setCenter({lat: res.data.latitude, lng: res.data.longitude})
        setIp(res.data.IPv4)
        const mail = getUsername(keycloak);

        await uberApi.getDriverStatus(mail,keycloak.token).then((res) => {
            if(res.data.status === 'AVAILABLE'){
                return;
            }
            console.log(res.data)
            setFocusCustomer(res.data.requestDTO.requestId)
            setCustomers([...customers, res.data.requestDTO])
            if (res.data.status === 'UNAVAILABLE') {
                setAcceptCall(true)
            }
            calculateRoute(res.data.requestDTO)
        })
    }

    useEffect(() => {
        getData().then()
    }, [])

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: '<YOUR-API-KEY>',
        libraries: ['places'],
    })


    if (!isLoaded) {
        return <SkeletonText />
    }

    function focusLeftPanel(requestId) {
        setFocusCustomer(requestId)
    }

    async function calculateRoute(customer) {
        if (directionsResponse) {
            clearRoute()
        }
        console.log(customer)
        // eslint-disable-next-line no-undef
        const directionsService = new google.maps.DirectionsService()
        const results = await directionsService.route({
            origin: { lat: customer.customerLocation.latitude, lng: customer.customerLocation.longitude },
            destination: {lat: customer.customerDestination.latitude, lng: customer.customerDestination.longitude },
            // eslint-disable-next-line no-undef
            travelMode: google.maps.TravelMode.DRIVING,
        })
        setDirectionsResponse(results)
        setDistance(results.routes[0].legs[0].distance.text)
        setDuration(results.routes[0].legs[0].duration.text)
        setDestination(results.routes[0].legs[0].end_location)
    }


    function clearRoute() {
        setDirectionsResponse(null)
        setDistance('')
        setDuration('')
    }

    function generateDriverCallPanel() {
        return (
            <Box
                p={4}
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                minW='container.md'
                zIndex='1'
            >
                <HStack spacing={4} mt={4} justifyContent='space-between'>
                    <Box>
                        <Text fontSize='xl' fontWeight='bold'>
                            Customer is waiting for you! <br/>
                            Please immediately go to the customer's location. <br/>
                            If you are late, the customer will cancel the call.
                        </Text>

                    </Box>
                    <Box>
                        <Image
                            src={'https://www.pngall.com/wp-content/uploads/13/Taxi-Yellow-PNG-Image.png'}
                            alt='Driver Profile Photo'
                            width='200px'
                            height='300px'
                        />
                    </Box>
                </HStack>
            </Box>
        )
    }


    function acceptCustomerAndChangePanel(requestId) {
        uberApi.acceptCustomer(requestId, keycloak.token).then((res) => {
            if (res.status === 200) {
                setAcceptCall(true)
                setFocusCustomer(requestId)
                calculateRoute(customers.find(customer => customer.requestId === requestId))
            }
        });
    }

    async function declineCustomer(requestId, mail) {
        await uberApi.declineCustomer(requestId, mail, keycloak.token).then((res) => {
            if (res.status === 200) {
                setAcceptCall(false)
                setCustomers([])
                setFocusCustomer(null)
                clearRoute()
            }
        });
    }

    return (
        <Flex
            position='relative'
            flexDirection='column'
            alignItems='center'
            h='100vh'
            w='100vw'
        >
                <GoogleMap
                    center={center}
                    zoom={12}
                    mapContainerStyle={{ width: '55%', height: '100%' , marginLeft: '44%' }}
                    options={{
                        zoomControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                    }}
                    onLoad={map => setMap(map)} >
                    {customers.length> 0 &&
                        customers.map((customer) => {
                        return (
                            <Marker
                                key={customer.requestId}
                                onClick={() => {
                                    map.panTo({ lat: customer.customerLocation.latitude, lng: customer.customerLocation.longitude })
                                    map.setZoom(15)
                                    focusLeftPanel(customer.requestId)
                                }}
                                position={{ lat: customer.customerLocation.latitude, lng: customer.customerLocation.longitude}}

                            >
                                {
                                    <InfoWindow
                                        position={{ lat: customer.customerLocation.latitude, lng: customer.customerLocation.longitude}}
                                        options={
                                            {
                                                pixelOffset: new window.google.maps.Size(0, -30),
                                                minWidth: 250,
                                            }
                                        }
                                    >
                                        <Box>
                                            <Text fontSize='xl' fontWeight='bold' color='black'>Customer Details</Text>
                                            <Text fontSize='md' fontWeight='bold' color='black'>Mail: {customer.customerEmail}</Text>
                                            <Text fontSize='md' fontWeight='bold' color='black'>Distance: {customer.distance}</Text>
                                            <Text fontSize='md' fontWeight='bold' color='black'>Price: {customer.price} ₺</Text>
                                            <Text fontSize='md' fontWeight='bold' color='black'>Special Offer: {customer.isSpecialOffer ? "Yes" : "No"}</Text>
                                        </Box>

                                    </InfoWindow>
                                }
                            </Marker>
                        )
                    })}
                    {<Marker position={center}/> }
                    {directionsResponse && (
                        <DirectionsRenderer directions={directionsResponse} />
                    )}
                </GoogleMap>
            <div style={{
                position: 'absolute',
                marginLeft: '-55.8%',
                width: '44%',
                zIndex: '1',
            }}>
            <Box
                outline={'2px solid #3182ce'}
                outlineColor={'red.65'}
                p={4}
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                minW='container.md'
                zIndex='1'
            >
                    <Text fontSize='xl' fontWeight='bold' textAlign={'center'}>
                        Customer Call Panel
                    </Text>

            </Box>
            </div>
            <div style={style}>
                <Table compact striped>
                    {acceptCall && focusCustomer !== null && generateDriverCallPanel()}
                    {customers.map((customer) => {
                        return (
                                <Box
                                    outline={ '2px solid #3182ce'}
                                    outlineColor={'facebook.300'}
                                    p={4}
                                    borderRadius='lg'
                                    m={4}
                                    bgColor='white'
                                    shadow='base'
                                    minW='container.md'
                                    zIndex='1'
                                >
                                    <HStack spacing={4} mt={4} justifyContent='space-between'>
                                        <Text
                                            color='black'
                                            fontWeight='bold'
                                            fontSize='lg'
                                        >Mail: <span style={{color:'green'}}>{customer.customerEmail}</span></Text>
                                        <ButtonGroup alignItems={
                                            'center'
                                        }>
                                            <Button
                                                colorScheme='blue'
                                                onClick={() => {
                                                    declineCustomer(customer.requestId,customer.customerEmail)
                                                }
                                                }
                                                disabled={acceptCall}

                                                style={
                                                    {
                                                        marginTop: '1rem',
                                                        marginLeft: '20rem',
                                                        width: '100%',
                                                        backgroundColor: 'red',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        fontSize: '1.2rem',
                                                        borderRadius: '0.5rem',
                                                        border: 'none',
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 0 0 0',
                                                        transition: 'all 0.3s ease 0s',
                                                        height: '3rem',

                                                    }}
                                            >
                                                Decline
                                            </Button>
                                            <Button
                                                colorScheme='green'
                                                disabled={acceptCall}
                                                onClick={() => {
                                                    acceptCustomerAndChangePanel(customer.requestId)
                                                }
                                                }
                                                style={
                                                    {
                                                        marginTop: '1rem',
                                                        marginLeft: '1rem',
                                                        width: '100%',
                                                        backgroundColor: 'green',
                                                        color: 'white',
                                                        fontWeight: 'bold',
                                                        fontSize: '1.2rem',
                                                        borderRadius: '0.5rem',
                                                        border: 'none',
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        boxShadow: '0 0 0 0',
                                                        transition: 'all 0.3s ease 0s',
                                                        height: '3rem',
                                                    }}
                                            >
                                                Accept
                                            </Button>
                                        </ButtonGroup>
                                  </HStack>
                                    <HStack spacing={4} mt={4} justifyContent='space-between'>
                                        <Text
                                            color='black'
                                            fontWeight='bold'
                                            fontSize='lg'
                                        >Distance Between Your And Driver: <span style={{color:'red'}}>{customer.distance} KM</span></Text>
                                        <Text
                                            color='black'
                                            fontWeight='bold'
                                            fontSize='lg'
                                        >Special Offer: <span style={{color:'red'}}>{customer.isSpecialOffer ? "Yes" : "No"}</span></Text>
                                        <Text
                                            color='black'
                                            fontWeight='bold'
                                            fontSize='lg'
                                        >Total: <span style={{color:'red'}}>{customer.price} TL</span></Text>
                                    </HStack>
                                </Box>
                        )
                    })}
                </Table>
            </div>
        </Flex>

    )

}

export default withRouter(withKeycloak(DriverPage));