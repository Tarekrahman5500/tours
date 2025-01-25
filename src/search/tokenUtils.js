export const fetchTestToken = async () => {
    const userName = validateEnv.SABRE_CERT_USER;
    console.log(userName);
    const password = process.env.SABRE_CERT_PASSWORD;
    console.log(password);
    const pcc = process.env.SABRE_CERT_PCC;
    const clientId = Buffer.from(`V1:${userName}:${pcc}:AA`).toString('base64');
    const clientSecret = Buffer.from(password).toString('base64');
    const secret = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const data = 'grant_type=client_credentials';
    const url = `${validateEnv.SABRE_BASE_CERT_URL}/v2/auth/token`;
    console.log({
      url,
    });
    //console.log(secret);
    const config = {
      method: 'POST',
      maxBodyLength: Infinity,
      url,
      headers: {
        Authorization: `Basic ${secret}`,
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data,
    };
  
    try {
      const response = await axios.request(config);
  
      return response.data.access_token;
    } catch (error) {
      // Handle error
      console.log(error.response.data);
      throw new ErrorResponse(
        `failed to create test access token`,
        httpStatus.BAD_REQUEST
      );
    }
  };