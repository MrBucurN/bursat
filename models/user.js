const mongoose = require('mongoose');

// Kullanıcı kalıbımızı (şemamızı) oluşturuyoruz
const userSchema = new mongoose.Schema({
  nickname: { 
    type: String, 
    required: true // Doldurulması zorunlu
  },
  username: { 
    type: String, 
    required: true,
    unique: true // Aynı e-posta ile iki kere kayıt olunamasın
  },
  password: { 
    type: String, 
    required: true 
  },
  avatar: { 
    type: String, 
    default: "" // Boş bırakılırsa otomatik "" olsun
  },
  status: { 
    type: String, 
    default: "" 
  },
  mutedPrivateEpostalar: {
    type: [String],
    default: []
  },
  mutedGroupIds: {
    type: [String],
    default: []
  }
}, { timestamps: true }); // Ne zaman kayıt olduklarını otomatik kaydeder

// Bu kalıbı diğer dosyalarda kullanabilmek için dışa aktarıyoruz
module.exports = mongoose.model('User', userSchema);
