global.window = {}
var expect = require("chai").expect;
var localStorage = require('mock-local-storage');
window.localStorage = global.localStorage
var AxiosJwtOobe = require("../lib/axios-jwt-oobe");
var moxios = require('moxios');
const { assert } = require("chai");

describe("Axios wrapper which adds transparent JWT handling.", function () {
    describe("Creates instance", function () {
        let axiosJwt = new AxiosJwtOobe();
        it("has parent jwt handler reference set up", function () {
            expect(axiosJwt.jwtHandler).to.be.a("object");
            expect(axiosJwt.jwtHandler.axiosJwt).to.be.a("function");
        });

        it("has default token field names", function () {
            expect(axiosJwt.jwtHandler.tokenFieldName).is.string("token");
            expect(axiosJwt.jwtHandler.refreshTokenFieldName).is.string("refresh_token");
        });

        it("allows set up of token field names", function () {
            axiosJwt.jwtHandler.setTokenFieldsNames("abc", "def");
            expect(axiosJwt.jwtHandler.tokenFieldName).is.string("abc");
            expect(axiosJwt.jwtHandler.refreshTokenFieldName).is.string("def");
        });

        it("allows manual set up of token and refresh token", function () {
            axiosJwt.jwtHandler.setToken("abc");
            expect(axiosJwt.jwtHandler.getToken()).is.string("abc");

            axiosJwt.jwtHandler.setRefreshToken("ghi");
            expect(axiosJwt.jwtHandler.getRefreshToken()).is.string("ghi");
        });

        it("allows to run without local storage", function () {
            let axiosJwtNoLocal = new AxiosJwtOobe({ useLocalStorage: false });
            axiosJwtNoLocal.jwtHandler.setToken("abc");
            expect(axiosJwtNoLocal.jwtHandler.getToken()).is.string("abc");
        });
    });
    describe("Makes a call", function () {
        let axiosJwt = null;

        beforeEach(() => {
            axiosInstance = new AxiosJwtOobe();
            moxios.install(axiosInstance.jwtHandler.axiosJwt);
            axiosInstance.jwtHandler.clearTokens();
        })
        afterEach(() => {
            moxios.uninstall(axiosInstance.jwtHandler.axiosJwt);
        })
        it("loads contents without auth header", function () {
            moxios.stubRequest('http://www.somesite.com/public-url', {
                status: 200,
                responseText: 'some text'
            });

            axiosInstance.get('http://www.somesite.com/public-url')
                .then(res => {
                    assert(res.status === 200);
                    assert(res.data === "some text");
                    expect(res.config.headers).to.not.haveOwnProperty("Authorization", "Expected authorization header");
                });
        });
        it("fails contents without auth header", function () {
            moxios.stubRequest('http://www.somesite.com/private-url', {
                status: 401,
                responseText: 'some text'
            });

            axiosInstance.get('http://www.somesite.com/private-url')
                .catch(res => {
                    assert(res.response.status === 401);
                    assert(res.response.data === "some text");
                    expect(res.config.headers).to.not.haveOwnProperty("Authorization", "Expected authorization header");
                });
        });
        it("signs up with valid credentials", function () {
            moxios.stubRequest('http://www.somesite.com/login-url', {
                status: 200,
                responseText: JSON.stringify({
                    "token": "maintoken",
                    "refresh_token": "refreshtoken"
                })
            });

            axiosInstance.jwtHandler.setLoginAction({
                "url": "http://www.somesite.com/login-url",
                "usernameField": "username",
                "passwordField": "password"
            })

            axiosInstance.jwtHandler.login("marian", "nowak").then(res => {
                assert(res === true);
                expect(axiosInstance.jwtHandler.getToken()).eq("maintoken", "Missing main token after signup");
                expect(axiosInstance.jwtHandler.getRefreshToken()).eq("refreshtoken", "Missing refresh token after signup");
            });
        });
        it("signs up with invalid credentials", function () {
            moxios.stubRequest('http://www.somesite.com/login-url', {
                status: 401,
                responseText: "invalid"
            });

            axiosInstance.jwtHandler.setLoginAction({
                "url": "http://www.somesite.com/login-url",
                "usernameField": "username",
                "passwordField": "password"
            })

            axiosInstance.jwtHandler.login("marian", "nowak").catch(err => {
                assert(err.response.status === 401);
            });
        });
        it("signs up with valid credentials and perform valid request", function () {
            moxios.stubRequest('http://www.somesite.com/login-url', {
                status: 200,
                responseText: JSON.stringify({
                    "token": "maintoken",
                    "refresh_token": "refreshtoken"
                })
            });

            moxios.stubRequest('http://www.somesite.com/private-url', {
                status: 200,
                responseText: JSON.stringify({
                    "data": "somedata",
                })
            });

            axiosInstance.jwtHandler.setLoginAction({
                "url": "http://www.somesite.com/login-url",
                "usernameField": "username",
                "passwordField": "password"
            })

            axiosInstance.jwtHandler.login("marian", "nowak").then(res => {
                axiosInstance.get('http://www.somesite.com/private-url').then(res => {
                    assert(res.status === 200);
                    expect(res.config.headers).to.haveOwnProperty("Authorization", "Bearer maintoken");
                });
            });
        });
        it("signs up with valid credentials, perform signed-out request and refresh", function () {
            moxios.stubRequest('http://www.somesite.com/login-url', {
                status: 200,
                responseText: JSON.stringify({
                    "token": "maintoken",
                    "refresh_token": "refreshtoken"
                })
            });

            moxios.stubRequest('http://www.somesite.com/retrieval-url', {
                status: 200,
                responseText: JSON.stringify({
                    "token": "new-maintoken",
                    "refresh_token": "new-refreshtoken"
                })
            });

            moxios.stubRequest('http://www.somesite.com/private-url', {
                status: 401,
                responseText: "irrelevant"
            });

            let obj = moxios.stubs.mostRecent()
            let count = 0
            Object.defineProperty(obj, 'response', {
                get: () => {
                    count++
                    if (count > 1) {
                        return { status: 200, responseText: 'signed' }
                    }
                    return { status: 401, responseText: 'not signed' }
                }
            })

            axiosInstance.jwtHandler.setLoginAction({
                "url": "http://www.somesite.com/login-url",
                "usernameField": "username",
                "passwordField": "password"
            })

            axiosInstance.jwtHandler.setRefreshRetrievalUrl("http://www.somesite.com/retrieval-url");

            axiosInstance.jwtHandler.login("marian", "nowak").then(res => {
                axiosInstance.get('http://www.somesite.com/private-url').then(res2 => {
                    assert(res2.status === 200);
                    expect(res2.config.headers).to.haveOwnProperty("Authorization", "Bearer new-maintoken");
                    expect(axiosInstance.jwtHandler.getRefreshToken() === "new-refreshtoken");
                });
            });
        });
    });
});
