// pages/webview/webview.js
const app = getApp();

Page({
  data: {
    webviewUrl: '', // web-view 的 src
    userData: null, // 用户信息
  },

  onLoad(options) {
    // 从 URL 参数或全局数据获取用户信息
    let userData = null;
    if (options.userData) {
      try {
        userData = JSON.parse(decodeURIComponent(options.userData));
      } catch (e) {
        console.error('解析用户数据失败:', e);
      }
    }

    // 如果没有从 URL 获取，尝试从全局数据获取
    if (!userData && app.globalData.userInfo) {
      userData = {
        nickname: app.globalData.userInfo.nickName || '',
        avatar: app.globalData.userInfo.avatarUrl || '',
        phoneNumber: app.globalData.phoneNumber || null,
      };
    }

    // 构建网页 URL（根据你的实际部署地址修改）
    // 开发环境可以使用 localhost，生产环境需要使用 HTTPS 域名
    // 注意：小程序 web-view 必须使用 HTTPS，且需要在微信公众平台配置业务域名
    // 开发环境测试时，可以使用内网穿透工具（如 ngrok）将本地服务暴露为 HTTPS
    const baseUrl = 'https://your-domain.com'; // TODO: 替换为你的实际域名，例如：https://chatbot.example.com
    const webviewUrl = baseUrl + (userData ? `?from=miniprogram&userData=${encodeURIComponent(JSON.stringify(userData))}` : '?from=miniprogram');

    this.setData({
      webviewUrl,
      userData
    });

    console.log('web-view URL:', webviewUrl);
  },

  // 接收网页消息
  onMessage(e) {
    console.log('收到网页消息:', e.detail.data);
    const data = e.detail.data[0];
    
    // 处理网页发送的消息
    if (data && data.type === 'requestUserInfo') {
      // 网页请求用户信息，发送给网页
      this.sendUserInfoToWeb();
    }
  },

  // 向网页发送用户信息
  sendUserInfoToWeb() {
    const userData = this.data.userData || {
      nickname: app.globalData.userInfo?.nickName || '',
      avatar: app.globalData.userInfo?.avatarUrl || '',
      phoneNumber: app.globalData.phoneNumber || null,
    };

    // 通过 web-view 的 postMessage 发送数据
    // 注意：需要在网页加载完成后才能发送
    const webviewContext = wx.createSelectorQuery().select('#webview');
    // 实际发送需要通过 web-view 组件的 bindmessage 事件
    // 这里先保存数据，等待网页请求时发送
    console.log('准备发送用户信息到网页:', userData);
  },

  // 网页加载完成
  onWebViewLoad() {
    console.log('网页加载完成');
    // 网页加载完成后，主动发送用户信息
    if (this.data.userData) {
      // 通过 URL 参数已经传递了用户信息，网页可以直接读取
      // 如果需要通过 postMessage，需要网页端主动请求
    }
  },

  // 网页加载错误
  onWebViewError(e) {
    console.error('网页加载错误:', e.detail);
    wx.showToast({
      title: '网页加载失败',
      icon: 'none'
    });
  }
});

