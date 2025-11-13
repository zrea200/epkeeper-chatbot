// pages/index/index.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    phoneNumber: null,
    phoneNumberDecrypted: null, // 解密后的手机号
    sessionKey: null,
    openid: null,
    loading: false,
  },

  onLoad() {
    // 检查是否支持 getUserProfile
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      });
    }
    
    // 自动登录获取 openid 和 session_key
    this.login();
  },

  // 微信登录获取 code，然后换取 session_key 和 openid
  login() {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('获取 code 成功:', res.code);
          // 调用后端接口换取 session_key 和 openid
          wx.request({
            url: 'https://your-domain.com/api/wechat/login', // TODO: 替换为你的实际域名
            method: 'POST',
            data: {
              code: res.code
            },
            success: (loginRes) => {
              if (loginRes.data.success) {
                console.log('登录成功:', loginRes.data);
                this.setData({
                  sessionKey: loginRes.data.data.session_key,
                  openid: loginRes.data.data.openid
                });
                app.globalData.openid = loginRes.data.data.openid;
                app.globalData.sessionKey = loginRes.data.data.session_key;
              } else {
                console.error('登录失败:', loginRes.data);
              }
            },
            fail: (err) => {
              console.error('登录请求失败:', err);
            }
          });
        } else {
          console.error('获取 code 失败:', res.errMsg);
        }
      },
      fail: (err) => {
        console.error('wx.login 失败:', err);
      }
    });
  },

  // 获取用户信息（昵称、头像）
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户信息成功:', res);
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });
        app.globalData.userInfo = res.userInfo;
        
        // 获取用户信息后，跳转到 web-view 页面
        this.navigateToWebView();
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      }
    });
  },

  // 获取手机号
  getPhoneNumber(e) {
    console.log('获取手机号回调:', e);
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      const { encryptedData, iv } = e.detail;
      const sessionKey = this.data.sessionKey || app.globalData.sessionKey;
      
      if (!sessionKey) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        // 重新登录
        this.login();
        return;
      }

      // 保存加密数据
      this.setData({
        phoneNumber: e.detail
      });
      app.globalData.phoneNumber = e.detail;

      // 调用后端接口解密手机号
      wx.request({
        url: 'https://your-domain.com/api/wechat/decrypt-phone', // TODO: 替换为你的实际域名
        method: 'POST',
        data: {
          encryptedData: encryptedData,
          iv: iv,
          sessionKey: sessionKey
        },
        success: (decryptRes) => {
          if (decryptRes.data.success) {
            const phoneNumber = decryptRes.data.data.phoneNumber;
            console.log('手机号解密成功:', phoneNumber);
            this.setData({
              phoneNumberDecrypted: phoneNumber
            });
            app.globalData.phoneNumberDecrypted = phoneNumber;
            
            wx.showToast({
              title: '获取手机号成功',
              icon: 'success'
            });
          } else {
            console.error('手机号解密失败:', decryptRes.data);
            wx.showToast({
              title: '解密失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('解密请求失败:', err);
          wx.showToast({
            title: '请求失败',
            icon: 'none'
          });
        }
      });
      
      // 如果已经有用户信息，跳转到 web-view
      if (this.data.hasUserInfo) {
        this.navigateToWebView();
      }
    } else {
      wx.showToast({
        title: '获取手机号失败',
        icon: 'none'
      });
    }
  },

  // 跳转到 web-view 页面
  navigateToWebView() {
    // 构建用户信息数据
    const userData = {
      nickname: this.data.userInfo?.nickName || '',
      avatar: this.data.userInfo?.avatarUrl || '',
      phoneNumber: this.data.phoneNumberDecrypted || null, // 使用解密后的手机号
      openid: this.data.openid || app.globalData.openid || null,
    };

    // 将用户信息存储到全局，供 web-view 页面使用
    app.globalData.userInfo = this.data.userInfo;
    app.globalData.phoneNumber = this.data.phoneNumber;
    app.globalData.phoneNumberDecrypted = this.data.phoneNumberDecrypted;

    // 跳转到 web-view 页面
    wx.navigateTo({
      url: `/pages/webview/webview?userData=${encodeURIComponent(JSON.stringify(userData))}`
    });
  },

  // 跳过授权，直接进入（可选）
  skipAuth() {
    wx.navigateTo({
      url: '/pages/webview/webview'
    });
  }
});

