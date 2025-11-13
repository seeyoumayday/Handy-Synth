// handposeModel.js
// ml5.handpose の初期化と予測コールバックの橋渡し

(function(){
  function init(video, onPredict){
    const model = ml5.handpose(video, () => {
      console.log('Handpose model ready');
    });
    if (onPredict && typeof onPredict === 'function'){
      model.on('predict', onPredict);
    }
    return model;
  }

  window.handposeCtrl = { init };
})();
