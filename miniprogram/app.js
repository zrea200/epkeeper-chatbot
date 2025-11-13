// app.js
App({
  onLaunch() {
    console.log('小程序启动');
  },
  globalData: {
    userInfo: null,
    openid: null,
    sessionKey: null,
    phoneNumber: null,
    phoneNumberDecrypted: null,
  }
});

