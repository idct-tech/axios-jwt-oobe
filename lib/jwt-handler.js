/**
 * JWT Handler associated to the Axios JWT Oobe class instances which is the
 * actual handler of all JWT refresh actions.
 *
 * @author IDCT Bartosz Pachołek <bartosz@idct.pl>
 * @license MIT
 */
class JwtHandler {

    /**
     * Sets the logout action which is executed additionally to the clearing of
     * tokens. Set to `null` to clear.
     *
     * @param {function} logoutAction
     * @throws "Action must be a function or null to clear"
     */
    setLogoutAction(logoutAction) {
        if (typeof logoutAction === "function") {
            this.logoutAction = logoutAction;
            return;
        }

        throw 'Action must be a function.';
    }

    /**
     * Deletes the configured logout action (if set).
     */
    clearLogoutAction() {
        if (typeof this.logoutAction !== "undefined") {
            delete this.logoutAction;
        }
    }

    /**
     * Sets the field names of token and refresh token in the response of both
     * `login` and `refresh` actions.
     *
     * @param {string} tokenFieldName
     * @param {string} refreshTokenFieldName
     */
    setTokenFieldsNames(tokenFieldName, refreshTokenFieldName) {
        this.tokenFieldName = tokenFieldName;
        this.refreshTokenFieldName = refreshTokenFieldName;
    }

    /**
     * Sets the actual function which is executed each time `login` is called or
     * an object which defines `url`, `usernameField` and `passwordField` formats
     * for a request made directly from Axios JWT Oobe.
     *
     * @param {function|object} loginActionInfo
     * @throws "LoginActioninfo must be a valid function or url and username, password fields details."
     */
    setLoginAction(loginActionInfo) {
        let type = typeof loginActionInfo;
        if (type === "function") {
            this.loginActionInfo = loginActionInfo;
            return;
        } else if (type === "object") {
            if (loginActionInfo.url === "undefined") {
                throw 'When in url mode url needs to be provided.';
            }

            if (loginActionInfo.usernameField === "undefined") {
                throw 'When in url mode username field needs to be provided.';
            }

            if (loginActionInfo.passwordField === "undefined") {
                throw 'When in url mdoe password field needs to be provided.';
            }

            this.loginActionInfo = loginActionInfo;
            return;
        }

        throw 'LoginActioninfo must be a valid function or url and username, password fields details.'
    }

    /**
     * Login action.
     * Attempts to sign in user and retrieve both token and refresh token.
     *
     * Executes the call to `loginActionInfo.url` with username and password sent
     * under `usernameField` and `passwordField` or calls `loginActionInfo`
     * directly if it is a function.
     *
     * @param {string} username
     * @param {string} password
     */
    login(username, password) {
        return new Promise((resolve, reject) => {
            let type = typeof this.loginActionInfo;
            if (type === "function") {
                this.loginActionInfo(username, password).then(res => {
                    let tokenDetails = res.data;
                    if (tokenDetails.token === "undefined" || tokenDetails.refreshToken === "undefined") {
                        throw 'Token or refresh token details not provided.';
                    }

                    this.setToken(tokenDetails.token);
                    this.setRefreshToken(tokenDetails.refreshToken);
                    resolve(true);
                }).catch(err => {
                    reject(err);
                });
            } else if (type === "object") {
                let data = {};
                data[this.loginActionInfo.usernameField] = username;
                data[this.loginActionInfo.passwordField] = password;
                this.axiosJwt.post(this.loginActionInfo.url, data).then(res => {
                    let outputData = res.data;
                    this.setToken(outputData[this.tokenFieldName]);
                    this.setRefreshToken(outputData[this.refreshTokenFieldName]);
                    resolve(true);
                }).catch(err => {
                    reject(err);
                })
            } else {
                reject(new Error('Login actions not defined: set them using setLoginActionInfo or sign in manually.'));
            }
        });
    }

    /**
     * Clears the tokens in local variables and in local storage (if enabled).
     */
    clearTokens() {
        delete this.token;
        delete this.refreshToken;
        if (this.useLocalStorage) {
            if (localStorage.getItem("jwt_token")) {
                localStorage.removeItem("jwt_token");
            }
            if (localStorage.getItem("jwt_refresh_token")) {
                localStorage.removeItem("jwt_refresh_token");
            }
        }
    }

    /**
     * Sets the url for refresh token calls.
     *
     * @todo A way to add actions similar to the login action.
     * @param {string} url
     */
    setRefreshRetrievalUrl(url) {
        this.refreshTokenRetrievalUrl = url;
    }

    /**
     * Gets the token from local storage if `useLocalStorage` enabled or from
     * `token` attribute or undefined.
     *
     * @returns {string|undefined}
     */
    getToken() {
        if (this.useLocalStorage) {
            return localStorage.getItem("jwt_token");
        }

        return this.token;
    }

    /**
     * Sets the token to local storage or `token` attr depending on the
     * `useLocalStorage` attribute.
     * @param {string} refreshToken
     */
    setToken(token) {
        if (this.useLocalStorage) {
            localStorage.setItem("jwt_token", token);
            return;
        }

        this.token = token;
    }

    /**
     * Gets the refresh token from local storage if `useLocalStorage` enabled or
     * from `refreshToken` attribute or undefined.
     *
     * @returns {string|undefined}
     */
    getRefreshToken() {
        if (this.useLocalStorage) {
            return localStorage.getItem("jwt_refresh_token");
        }

        return this.refreshToken;
    }

    /**
     * Sets the refresh token to local storage or `refreshToken` attr depending
     * on the `useLocalStorage` attribute.
     * @param {string} refreshToken
     */
    setRefreshToken(refreshToken) {
        if (this.useLocalStorage) {
            localStorage.setItem("jwt_refresh_token", refreshToken);
            return;
        }

        this.refreshToken = refreshToken;
    }

    /**
     * Intercepts the request and in case we have token adds it to headers.
     *
     * @param {object} config
     */
    requestInterceptor(config) {
        if (!this.getToken()) {
            return config;
        }

        config.headers = {
            ...config.headers,
            'Authorization': 'Bearer ' + this.getToken(),
        }

        return config;
    }

    /**
     * Pass-thru wrapper over success response
     *
     * @param {Promise} response
     */
    successResponse(response) {
        return response;
    }

    /**
     * The most important part of the code: of the response interceptors. which
     * attempts to request refresh token if an authorized called failed.
     *
     * @param {object} error
     */
    failureResponse(error) {
        if (401 === error.response.status && error.config.secondAttempt !== true && this.getRefreshToken() && error.config.url !== this.refreshTokenRetrievalUrl) {
            return new Promise(async (resolve, reject) => {
                await this.axiosJwt.post(this.refreshTokenRetrievalUrl, {
                    "token": this.getToken(),
                    "refresh_token": this.getRefreshToken()
                }).then((res) => {
                    this.setToken(res.data.token);
                    this.setRefreshToken(res.data.refresh_token);
                    let config = error.config;
                    //update config
                    config = this.requestInterceptor(config);
                    config.secondAttempt = true;
                    resolve(this.axiosJwt(config));
                }).catch((err) => {
                    if (typeof this.logoutAction === "function") {
                        this.logoutAction(err);
                        this.clearTokens();
                    } else {
                        reject(error);
                    }
                });
            });
        } else {
            return Promise.reject(error);
        }
    }
}

module.exports = JwtHandler;
