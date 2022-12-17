import React, {useContext, useEffect, useRef, useState} from "react";
import toast, { Toaster } from 'react-hot-toast';
import {
    Box,
    Button,
    ButtonGroup,
    Flex,
    HStack,
    IconButton,
    Input,
    SkeletonText,
    Text,
} from '@chakra-ui/react'
import {FaLocationArrow, FaTimes} from 'react-icons/fa'
import {
    useJsApiLoader,
    GoogleMap,
    Marker,
    Autocomplete,
    DirectionsRenderer, InfoWindow,
} from '@react-google-maps/api'
import {Container, Image, Table} from 'semantic-ui-react'
import {uberAPI as uberApi} from "../misc/UberAPI";
import {useKeycloak, withKeycloak} from "@react-keycloak/web";
import {withRouter} from "react-router-dom";
import useWebSocket, { ReadyState } from 'react-use-websocket';
import {getUsername} from "../misc/Helpers";
import ConfirmationModal from "../misc/ConfirmationModal";
import {DataContext} from "../misc/Balance";


function MapContainer(){
    const WEBSOCKET_URL = 'ws://localhost:9090/customer';
    const [center, setCenter] = useState()
    const [ip, setIp] = useState('')
    const [driverMarker, setDriverMarker] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [focusDriver, setFocusDriver] = useState(null);
    const height = window.innerHeight - 200
    const { keycloak } = useKeycloak();
    const [callingRequest, setCallingRequest] = useState(null);
    const [acceptDriver, setAcceptDriver] = useState(false);
    const [map, setMap] = useState( null)
    const [directionsResponse, setDirectionsResponse] = useState(null)
    const [distance, setDistance] = useState('')
    const [duration, setDuration] = useState('')
    const [checkNull, setCheckNull] = useState(true)
    const [calling, setCalling] = useState(false)
    const [destination, setDestination] = useState(null)
    const originRef = useRef()
    const destinationRef = useRef()
    const [memTarget, setMemTarget] = useState(null);
    const [username, setUsername] = useState(null);
    const [socketUrl, setSocketUrl] = useState(WEBSOCKET_URL);
    const [messageHistory, setMessageHistory] = useState([]);
    const notifySuccess = (message) => toast.success(message);
    const notifyError = (message) => toast.error(message);
    const {setBalance} = useContext(DataContext)

    const {
        sendMessage,
        lastMessage,
        readyState,
    } = useWebSocket(socketUrl);
    const style = {
        marginLeft: '-95%',
    }

    const [modal, setModal] = useState({
            isOpen: false,
            header: '',
            content: '',
            onAction: null,
            onClose: null
        });


    useEffect(async () => {
        if (readyState === ReadyState.OPEN) {
            console.log('Connection is open');
        }
        if (lastMessage !== null) {
            let data = JSON.parse(lastMessage.data);
            if (data.dataType === 'DRIVER') {
                setMessageHistory(prev => [...prev, lastMessage]);
                console.log(data);
                const {driverStatus, requestId, customerMail} = data;
                if (acceptDriver && customerMail === getUsername(keycloak) && requestId === callingRequest) {
                    clearRoute();
                    setAcceptDriver(false);
                    setCallingRequest(null);
                    setCalling(false);
                    setFocusDriver(null);
                    setDrivers([]);
                    notifySuccess('The journey is over, thank you for using our service!');
                }
                if (driverStatus === 'UNAVAILABLE' && requestId === callingRequest) {
                    setAcceptDriver(true);
                    notifySuccess('Driver accepted your request, please wait for driver to arrive');
                    await uberApi.getUserBalance(username, keycloak.token).then(
                        (response) => {
                            setBalance(response.data);
                        }
                    )
                } else if (driverStatus === 'AVAILABLE' && requestId === callingRequest) {
                    setAcceptDriver(false);
                    setCalling(false);
                    setFocusDriver(null);
                    setCallingRequest(null);
                    setDrivers([]);
                    notifyError('Driver is cancelled your request, please try again or call another driver or make offer!');
                    await mapClick(memTarget);
                }
            }
        }

    }, [lastMessage,setMessageHistory]);


    useEffect(async () => {
        await uberApi.getDefaultDataInformation().then((response) => {
            setUsername(getUsername(keycloak))
            uberApi.getCustomerStatus(getUsername(keycloak), response.data.IPv4, keycloak.token).then(res => {
                setCenter({lat: res.data.customerLocation.latitude, lng: res.data.customerLocation.longitude})
                setIp(response.data.IPv4)
                if (res.data.status === 'ON_THE_WAY') {
                    setDrivers(prev => [...prev, res.data.driver])
                    setCallingRequest(res.data.driver.pendingRequest.requestId)
                    setAcceptDriver(true)
                    setCalling(true)
                    onLoadDirection([res.data.driver]).then();
                } else if (res.data.status === 'WAITING') {
                    setFocusDriver(res.data.driver.id)
                    setCalling(true)
                    setCallingRequest(res.data.driver.pendingRequest.requestId)
                    setDrivers(prevState => [...prevState, res.data.driver])
                }
            })
        })
    }, [])

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: '<YOUR-API-KEY>',
        libraries: ['places'],
    })

    const getDriverList = async (disc) => {
        disc = disc.split(' ')[0].replace(',', '.');
        await uberApi.getDriverList(ip,disc,keycloak.token).then((res) => {
            res.data.forEach((driver) => {
                const newPlace = {
                    id: driver.id,
                    lat: driver.driver_location.latitude,
                    lng: driver.driver_location.longitude,
                }
                setDriverMarker((prev) => {
                    return [...prev.filter((item) => item.id !== driver.id), newPlace]
                })
                setDrivers((prev) => {
                    return [...prev.filter((item) => item.id !== driver.id), driver].sort((a, b) => a.driver_location.distance - b.driver_location.distance)
                })
            })
        })
    }

    function numberTwoDigitScale(x) {
        return Number.parseFloat(x).toFixed(2);
    }

    if (!isLoaded) {
        return <SkeletonText />
    }

    async function calculateRoute() {
        if (originRef.current.value === '' || destinationRef.current.value === '') {
            return
        }
        // eslint-disable-next-line no-undef
        const directionsService = new google.maps.DirectionsService()
        const results = await directionsService.route({
            origin: originRef.current.value,
            destination: destinationRef.current.value,
            // eslint-disable-next-line no-undef
            travelMode: google.maps.TravelMode.DRIVING,
        })
        setDirectionsResponse(results)
        setDistance(results.routes[0].legs[0].distance.text)
        setDuration(results.routes[0].legs[0].duration.text)
        setDestination(results.routes[0].legs[0].end_location)
        await getDriverList(results.routes[0].legs[0].distance.text)
    }

    function clearRoute() {
        setDirectionsResponse(null)
        setDistance('')
        setDuration('')
        originRef.current.value = ''
        destinationRef.current.value = ''
    }

    function originAndDestinationNullCheck(){
        return originRef?.current?.value === '' || destinationRef?.current?.value === ''
    }

    async function mapClick(e) {
        // if (calling) {
        //     return
        // }
        if (directionsResponse) {
            clearRoute()
        }
        // eslint-disable-next-line no-undef
        const directionsService = new google.maps.DirectionsService()
        const results = await directionsService.route({
            origin: { lat: center.lat, lng: center.lng },
            destination: { lat: e.latLng.lat(), lng: e.latLng.lng() },
            // eslint-disable-next-line no-undef
            travelMode: google.maps.TravelMode.DRIVING,
        })
        setDirectionsResponse(results)
        setDistance(results.routes[0].legs[0].distance.text)
        setDuration(results.routes[0].legs[0].duration.text)
        setDestination(results.routes[0].legs[0].end_location)
        await getDriverList(results.routes[0].legs[0].distance.text)
    }

    async function onLoadDirection(driver) {
        // eslint-disable-next-line no-undef
        const directionsService = new google.maps.DirectionsService()
        const results = await directionsService.route({
            origin: {lat: driver[0].pendingRequest.customerLocation.latitude, lng: driver[0].pendingRequest.customerLocation.longitude},
            destination: {lat: driver[0].pendingRequest.customerDestination.latitude, lng: driver[0].pendingRequest.customerDestination.longitude},
            // eslint-disable-next-line no-undef
            travelMode: google.maps.TravelMode.DRIVING,
        })
        setDirectionsResponse(results)
        setDistance(results.routes[0].legs[0].distance.text)
        setDuration(results.routes[0].legs[0].duration.text)
        setDestination(results.routes[0].legs[0].end_location)
    }

    function changeCheck() {
        if (originAndDestinationNullCheck()) {
            setCheckNull(true)
        }
        else {
            setCheckNull(false)
        }
    }

    function focusLeftPanel(id, side) {
        setFocusDriver(id)
        // sorted by distance but first select id
        if (side === 'left') {
            return;
        }
        drivers.sort((a, b) => {
            return a.driver_location.distance - b.driver_location.distance
        })
        setDrivers(prevState => {
            return [drivers.find((item) => item.id === id), ...prevState.filter((item) => item.id !== id)]
        })
    }

    function generateDriverCallPanel(driver) {
        return (
            <Container
            >
            <Box
                outline={'2px solid #3182ce'}
                outlineColor={ 'red'}
                p={2}
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                maxWidth={'852px'}
                marginLeft={'12rem'}
                zIndex='1'
            >
                <HStack spacing={4} mt={4} justifyContent='space-between'>
                    <Box>
                        <Text fontSize='md' fontWeight='bold' color='blue'>Your request is being processed by the driver...  <i size="60" className="fas fa-spinner fa-spin"></i></Text>
                        <Text fontSize='md' fontWeight='bold' color='blue'>You can cancel your request from the "My Requests" page.</Text>
                        <Text fontSize='md' fontWeight='bold' color='red'>If the driver does not respond in 5 minutes, your request will be canceled automatically.</Text>
                    </Box>
                    <Box>
                        <Image
                            src={'https://media.tenor.com/YHX7yByOE4AAAAAd/taxi-jamrock-taxi.gif'}
                            alt='Driver Profile Photo'
                            width='400px'
                            height='400px'
                        />
                    </Box>
                </HStack>
            </Box>
            </Container>

        )
    }

    async function callDriver(driver,specialRequest= false, offerPrice) {
        const callDriverCommand = {
            ipAddress: ip,
            customerEmail: username,
            driverEmail: driver.email,
            pendingRequest: {
                ipAddress: ip,
                driverEmail: driver.email,
                customerEmail: username,
                customerLocation: {
                    latitude: center.lat,
                    longitude: center.lng,
                    country: 'Turkey',
                    city: 'Istanbul',
                    distance: distance.split(' ')[0].replace(',', '.'),
                },
                customerDestination: {
                    latitude: destination.lat(),
                    longitude: destination.lng(),
                    country: 'Turkey',
                    city: 'Istanbul',
                    distance: distance.split(' ')[0].replace(',', '.'),
                },
                offer: offerPrice ? offerPrice : driver.price,
                isSpecialOffer: specialRequest,
            }
        }
        await uberApi.callTaxi(callDriverCommand, driver.email, keycloak.token).then((res) => {
            if (res.status === 200) {
                setDriverMarker(prevState => {
                    return prevState.filter((item) => item.id === driver.id)
                })
                setDrivers(prevState => {
                    return prevState.filter((item) => item.id === driver.id)
                })
                setDriverMarker([])
                setCallingRequest(res.data.requestId)
                notifySuccess('Driver called successfully');
            }
        })
    }

    function generateWaitingPanel() {
        return (
            <Box
                outline={'2px solid #3182ce'}
                outlineColor={ 'red'}
                p={2}
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                maxWidth={'852px'}
                marginLeft={'49.5rem'}
                zIndex='1'
            >
                <HStack spacing={4} mt={4} >
                    <Box>
                        <Text fontSize='md' fontWeight='bold' color='blue'>Your request is accepted by the driver...  <i size="60" className="fas fa-spinner fa-spin"></i></Text>
                        <Text fontSize='md' fontWeight='bold' color='blue'>Please wait for the driver to arrive.</Text>
                        <Text fontSize='md' fontWeight='bold' color='red'>If the driver does not arrive in 20 minutes, your request will be canceled automatically.</Text>
                    </Box>
                    <Box>
                        <Image
                            src={'https://i.pinimg.com/originals/21/3d/c2/213dc210c77be4c26294b296c242b79a.gif'}
                            alt='Driver Profile Photo'
                            width='400px'
                            height='400px'
                        />
                    </Box>
                </HStack>
            </Box>
        )
    }

    async function makeOffer(driver) {
        setModal({
            isOpen: true,
            title: 'Make Offer',
            content: (
                <Box>
                    <Text fontSize='md' fontWeight='bold' color='blue'>You can entered minimum : {driver.price} TL</Text> <br/>
                    <Text fontSize='md' fontWeight='bold' color='blue'>Please enter your offer:</Text> <br/>
                    <Input
                        id={'offer'}
                        style={
                            {
                                width: '100%',
                                height: '50px',
                                borderRadius: '5px',
                                border: '1px solid #3182ce',
                                padding: '0 10px',
                                fontSize: '16px',
                                outline: 'none',
                                marginBottom: '10px'

                            }}
                        type='number'
                        placeholder='Offer'
                    />
                </Box>
            ),
            onAction: (response) => {
                if (response) {
                const offer = document.getElementById('offer').value
                if (offer < driver.price) {
                    alert('Please enter higher ' + driver.price + ' TL' +
                        ', your offer is less than minimum offer money!')
                    return;
                }
                callDriver(driver,true,offer)
                map.panTo(center)
                map.setZoom(15)
                setCalling(true)
                driver.driverStatus = 'CALLING';
                driver.price = offer;
                notifySuccess('Offer sent successfully, please wait for the driver to accept your offer.');
                setModal({
                    isOpen: false,
                    title: '',
                    content: '',
                    onClose: () => {
                    }
                })}
                else {
                    setModal({
                        isOpen: false,
                        title: '',
                        content: '',
                        onClose: () => {
                        }
                    })
                }
            },
            onClose: () => {
                setModal({
                    isOpen: false,
                    title: '',
                    content: '',
                    onClose: () => {
                    }
                })
            },

        })

    }

    return (
        <Container>
            <Box h='100%' w='100%'
                    position='absolute'
                    zIndex='0'
                    top='0'
                    left='0'
                    overflow='hidden'

            >
                <GoogleMap
                    center={center}
                    onClick={(e) => {
                        setMemTarget(e)
                        mapClick(e)
                    }}
                    zoom={12}
                    mapContainerStyle={{ width: '55%', height: '100%' , marginLeft: '50%', marginTop: '3%'}}
                    options={{
                        zoomControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                    }}
                    onLoad={map => setMap(map)}
                >
                    {driverMarker.map((driver) => {
                        return (
                            <Marker
                                key={driver.id}
                                onClick={() => {
                                    map.panTo({ lat: driver.lat, lng: driver.lng })
                                    map.setZoom(15)
                                    focusLeftPanel(driver.id,'marker')
                                }}
                                position={{ lat: driver.lat, lng: driver.lng }}
                                icon={{
                                    url: 'https://purepng.com/public/uploads/large/taxi-circle-icon-trx.png',
                                    size: new window.google.maps.Size(100, 100),
                                    origin: new window.google.maps.Point(0, 0),
                                    anchor: new window.google.maps.Point(15, 15),
                                    scaledSize: new window.google.maps.Size(60, 60)
                                }}
                            >
                                {driver.id === focusDriver && (
                                    <InfoWindow
                                        position={{ lat: driver.lat, lng: driver.lng }}
                                        onCloseClick={() => {
                                            setFocusDriver(null)
                                        }}
                                        options={
                                            {
                                                pixelOffset: new window.google.maps.Size(0, 10),
                                                minWidth: 250,
                                            }
                                        }
                                    >
                                             <div>
                                                <div style={{ fontSize: 16, fontWeight: 'bold' }}>Driver Information</div>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>Name: {drivers.find((item) => item.id === driver.id).name}</div>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>Phone: {drivers.find((item) => item.id === driver.id).phone}</div>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>Email: {drivers.find((item) => item.id === driver.id).email}</div>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>Price:  {drivers.find((item) => item.id === driver.id).driver_location.duration}
                                                    {numberTwoDigitScale(drivers.find((item) => item.id === driver.id).price)} TL</div>
                                                <div style={{ fontSize: 14, fontWeight: 'bold' }}>Distance: {distance}</div>
                                            <Table.Row>
                                            <Button onClick={() => makeOffer(drivers.find((item) => item.id === driver.id))}

                                                    disabled={calling} colorScheme='green' type='submit'
                                                     style={
                                                    {
                                                        marginTop: '10px',
                                                        fontSize: '16px',
                                                        fontWeight: '400',
                                                        border: 'none',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        outline: 'none',
                                                    }
                                                }>Make Offer</Button>
                                            <Button  colorScheme='red' type='submit'
                                                     onClick={() => {
                                                         map.panTo(center)
                                                         map.setZoom(15)
                                                         setCalling(true)
                                                         drivers.find((item) => item.id === driver.id).driverStatus = 'CALLING'
                                                         callDriver(drivers.find((item) => item.id === driver.id))
                                                     }}
                                                     disabled={calling} style={
                                                {
                                                    marginLeft: '2rem',
                                                    width: '100px',
                                                    marginTop: '10px',
                                                    fontSize: '16px',
                                                    fontWeight: '400',
                                                    border: 'none',
                                                    borderRadius: '20px',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                }
                                            }>Call Driver</Button>
                                            </Table.Row>
                                            </div>
                                    </InfoWindow>
                                )}
                            </Marker>
                        )
                    })}
                    {!directionsResponse && <Marker position={center}/> }
                    {directionsResponse && (
                        <DirectionsRenderer directions={directionsResponse} />
                    )}
                </GoogleMap>
            </Box>
            <Box
                p={4}
                borderRadius='lg'
                m={4}
                bgColor='white'
                shadow='base'
                marginLeft={'-25%'}
                w={'60%'}
                zIndex='1'
            >
                <HStack spacing={2} justifyContent='space-between'>
                    <Box flexGrow={1}>
                        <Autocomplete>
                            <Input type='text' onChange={changeCheck} placeholder='Origin' ref={originRef}  />
                        </Autocomplete>
                    </Box>
                    <Box flexGrow={1}>
                        <Autocomplete>
                            <Input
                                type='text'
                                onChange={changeCheck}
                                placeholder='Destination'
                                ref={destinationRef}
                            />
                        </Autocomplete>
                    </Box>

                    <ButtonGroup>
                        <Button colorScheme='pink' type='submit' onClick={calculateRoute} disabled={checkNull || calling}>
                            Calculate Route
                        </Button>
                        <IconButton
                            aria-label='center back'
                            icon={<FaTimes />}
                            onClick={clearRoute}
                        />
                    </ButtonGroup>
                </HStack>
                <HStack spacing={4} mt={4} justifyContent='space-between'>
                    <Text
                        fontSize='lg'
                        fontWeight='bold'
                        color='gray.500'
                        textAlign='center'
                    >Distance: <span style={{color:'red'}}>{distance}</span> </Text>
                    <Text
                        fontSize='lg'
                        fontWeight='bold'
                        color='gray.500'
                        marginLeft={'-90%'}
                    >Duration:<span style={{color:'red'}}> {duration} </span></Text>
                    <IconButton
                        aria-label='center back'
                        icon={<FaLocationArrow />}
                        isRound
                        onClick={() => {
                            map.panTo(center)
                            map.setZoom(15)
                        }}
                    />
                </HStack>
            </Box>

            <div style={style}>
                <Table  >
                    {calling && !acceptDriver  && generateDriverCallPanel(focusDriver)}
                    {callingRequest && acceptDriver && generateWaitingPanel()}
            {drivers.map((driver) => {
                return (
                    <div onClick={() => {
                        map.panTo({ lat: driver.driver_location.latitude, lng: driver.driver_location.longitude })
                        map.setZoom(15)
                        focusLeftPanel(driver.id,'left')
                    }}
                         style={
                                {
                                    cursor: 'pointer',
                                    backgroundColor: driver.id === focusDriver ? '#f2f2f2' : 'white',
                                    padding: '10px',
                                    borderRadius: '10px',
                                    marginBottom: '10px',
                                }
                         }
                    id={'panel ' + driver.id}
                    >
                    <Box
                        outline={focusDriver === driver.id ? '2px solid #3182ce' : 'none'}
                        outlineColor={focusDriver === driver.id ? 'red' : 'none'}
                        opacity={focusDriver === driver.id ? '1' : '0.6'}
                        p={4}
                        borderRadius='lg'
                        m={4}
                        w={'40%'}
                        marginLeft={'32%'}
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
                                >Name: <span style={{color:'green'}}>{driver.name}</span></Text>
                                <Text
                                    fontWeight='bold'
                                    fontSize='lg'
                                >Driver Phone: <span style={{color:'green'}}> {driver.phone}</span> </Text>
                                <Text
                                    color='black'
                                    fontWeight='bold'
                                    fontSize='lg'
                                >Driver Status: {driver.driverStatus === 'AVAILABLE' ? <span style={{color:'green'}}>{driver.driverStatus}</span> : <span style={{color:'red'}}>{driver.driverStatus}</span>}</Text>
                        </HStack>
                        <HStack spacing={4} mt={4} justifyContent='space-between'>
                        <Text
                            color='black'
                            fontWeight='bold'
                            fontSize='lg'
                        >Distance Between Your And Driver: <span style={{color:'red'}}>{numberTwoDigitScale(driver.driver_location.distance)} KM</span></Text>
                        <Text
                            color='black'
                            fontWeight='bold'
                            fontSize='lg'
                        >Total: <span style={{color:'red'}}>{numberTwoDigitScale(driver.price ? driver.price : driver.pendingRequest.offer) } TL</span></Text>
                        <ButtonGroup>
                            <Button disabled={calling}  colorScheme='green' type='submit' style={
                                {
                                    textAlign: 'center',
                                    borderRadius: '10px',
                                }
                            } onClick={() => {makeOffer(driver)}}>
                                💲 Make Offer
                            </Button>
                            <Button  colorScheme='red' type='submit' style={
                                {
                                    textAlign: 'center',
                                    borderRadius: '10px',
                                }
                            }
                                     disabled={calling}
                                     onClick={
                                () => {
                                    map.panTo(center)
                                    map.setZoom(15)
                                    setCalling(true)
                                    driver.driverStatus = 'CALLING'
                                    callDriver(driver)
                                }
                            }>
                                📞 Call Driver
                            </Button>
                        </ButtonGroup>
                        </HStack>
                    </Box>
                    </div>
                )
            })}
                </Table>
                <Toaster position={"bottom-left"}
                         toastOptions={{style: {fontSize: '14px', fontWeight: 'bold' , color: 'red'} , duration: 5000}}
                         reverseOrder={false}
                />
            </div>
            <ConfirmationModal modal={modal} />
        </Container>
    )

}

export default withRouter(withKeycloak(MapContainer));