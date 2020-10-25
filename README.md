Axios JWT Out of the box experience
===================================

Wrapper around Axios which adds out-of-the-box experience for JWT Tokens with Refresh Tokens.

# installation

Execute:
`npm install axios-jwt-oobe`
in your application and import it into your project usign the format of your choice (import, require).

# usage

Create a new instance:

```javascript
let axiosJwt = new AxiosJwtOobe(options);
```

* options are optional

## configuration

In order for the JWT handler to work you need to define few values:

* token and refresh token field names in responses
* refresh token url

If you want to use the internal `login` method then you also need to define one of the following:

* login action function
* login url, username and password fields

## examples

If your refresh url is: `https://somesite.com/auth/refresh`, login url is: `https://somesite.com/auth/login`, both accept username and password using format:
```json
{
    "x-username": "someusername",
    "x-password": "somepassword"
}
```

and your login methods return tokens in format:
```json
{
    "super-token": "....",
    "super-refresh-token": "....."
}
```

Then you should set the refresh token url to `https://somesite.com/auth/refresh`, username field to `x-username` and password field to `x-password`.

You can do this by passing constructor options: `refreshTokenRetrievalUrl`, `usernameField`, `passwordField`, `tokenFieldName`, `refreshTokenFieldName` or by calling methods:

```javascript
axiosJwt.jwtHandler.setLoginAction({
    "url": "https://somesite.com/auth/login",
    "usernameField": "x-username",
    "passwordField": "x-password"
});

axiosJwt.jwtHandler.setRefreshRetrievalUrl("https://somesite.com/auth/refresh");
axiosJwt.jwtHandler.setTokenFieldsNames("super-token", "super-refresh-token");
```

# TODO

This a very early version of the application yet it already should simplify the process of handling JWT refresh tokens.
Current todos include:
- better tests split
- option to pass refresh action instead of only url
- allow to set different token field names for login and refresh actions

# Contribution

Any reported issues or pull requests are more than welcome.