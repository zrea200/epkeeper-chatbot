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
            url: 'https://electric.langcore.net/api/wechat/login',
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
        url: 'https://electric.langcore.net/api/wechat/decrypt-phone',
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

  // 保存用户信息到后端，然后跳转到网页
  async navigateToWebView() {
    const openid = this.data.openid || app.globalData.openid;
    const nickname = this.data.userInfo?.nickName || '';
    const avatar = this.data.userInfo?.avatarUrl || '';
    const phoneNumber = this.data.phoneNumberDecrypted || null;

    // 如果没有 openid，先尝试登录
    if (!openid) {
      wx.showToast({
        title: '正在登录...',
        icon: 'loading'
      });
      // 等待登录完成
      await new Promise((resolve) => {
        setTimeout(() => {
          const newOpenid = this.data.openid || app.globalData.openid;
          if (newOpenid) {
            resolve(newOpenid);
          } else {
            resolve(null);
          }
        }, 1000);
      });
    }

    const finalOpenid = this.data.openid || app.globalData.openid;
    
    if (!finalOpenid) {
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      });
      return;
    }

    // 保存用户信息到后端
    wx.request({
      url: 'https://electric.langcore.net/api/wechat/user', // 使用实际域名
      method: 'POST',
      data: {
        openid: finalOpenid,
        nickname: nickname,
        avatar: avatar,
        phoneNumber: phoneNumber,
        source: 'miniprogram',
      },
      success: (res) => {
        if (res.data.success) {
          console.log('用户信息已保存到后端');
          // 跳转到网页（使用小程序跳转外部链接）
          wx.showModal({
            title: '授权成功',
            content: '即将跳转到智能助手页面',
            showCancel: false,
            success: () => {
              // 复制链接到剪贴板
              wx.setClipboardData({
                data: 'https://electric.langcore.net/',
                success: () => {
                  wx.showModal({
                    title: '链接已复制',
                    content: '请在浏览器中打开链接访问智能助手',
                    showCancel: false,
                    confirmText: '知道了',
                  });
                }
              });
            }
          });
        } else {
          console.error('保存用户信息失败:', res.data);
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('保存用户信息请求失败:', err);
        // 即使保存失败，也允许用户跳转
        wx.showModal({
          title: '提示',
          content: '网络错误，但您可以继续访问',
          showCancel: false,
          success: () => {
            wx.setClipboardData({
              data: 'https://electric.langcore.net/',
              success: () => {
                wx.showModal({
                  title: '链接已复制',
                  content: '请在浏览器中打开链接访问智能助手',
                  showCancel: false,
                });
              }
            });
          }
        });
      }
    });
  },

  // 跳过授权，直接进入（可选）
  skipAuth() {
    wx.setClipboardData({
      data: 'https://electric.langcore.net/',
      success: () => {
        wx.showModal({
          title: '链接已复制',
          content: '请在浏览器中打开链接访问智能助手',
          showCancel: false,
          confirmText: '知道了',
        });
      }
    });
  }
});

