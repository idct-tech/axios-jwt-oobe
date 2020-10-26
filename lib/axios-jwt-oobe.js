'use strict';
let axios = require('axios');
let JwtHandler = require('./jwt-handler');

/**
 * Axios JWT Out-of-the-box-experience
 *
 * Wrapper around Axios which adds out-of-the-box experience for JWT Tokens with Refresh Tokens.
 *
 * @author IDCT Bartosz Pachołek <bartosz@idct.pl>
 * @license MIT
 */
class AxiosJwtOobe {
    /**
     * Creates new instance of the AxiosJwtOobe.
     *
     * Startup options include:
     * - tokenFieldName
     * - refreshTokenFieldName
     * - refreshTokenRetrievalUrl
     * - loginActionInfo
     * - useLocalStorage
     * - axiosJwt
     *
     * @param {Object} options - Startup options
     */
    constructor(options = {}) {
        const instance = axios.create(options);

        //sets the assigned jwt handler
        const jwtHandler = new JwtHandler();
        instance.jwtHandler = jwtHandler;

        //if both: token field name and refresh token field name are set then assigns them
        //defaults to `token` and `refresh_token`
        if (options.tokenFieldName && options.refreshTokenFieldName) {
            jwtHandler.setTokenFieldsNames(options.tokenFieldName, options.refreshTokenFieldName);
        } else {
            jwtHandler.setTokenFieldsNames("token", "refresh_token");
        }

        //sets the refresh token retrieval url if present
        if (options.refreshTokenRetrievalUrl) {
            jwtHandler.refreshTokenRetrievalUrl = options.refreshTokenRetrievalUrl;
        }

        //set sthe login action info (check readme) if present
        if (options.loginActionInfo) {
            jwtHandler.setLoginAction(options.loginActionInfo);
        }

        //sets the logout action which additionally executed to clearing of tokens
        if (options.logoutAction) {
            jwtHandler.setLogoutAction(options.logoutAction);
        }

        //sets if values should be stored in local storage: defaults to true
        jwtHandler.useLocalStorage = options.useLocalStorage === false ? false : true;

        //sets cross reference of services
        jwtHandler.axiosJwt = instance;

        //we need to catch all requests...
        instance.interceptors.request.use((request) => { return jwtHandler.requestInterceptorAction(request); });

        ///and responses to catch 401
        instance.interceptors.response.use(
            (response) => { return jwtHandler.successResponse(response); },
            (response) => { return jwtHandler.failureResponse(response); }
        );

        return instance;
    }
}

module.exports = AxiosJwtOobe;