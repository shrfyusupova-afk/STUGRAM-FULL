package com.example.myapplication.ui.auth.register

import android.content.Context
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.FullRegisterRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.VerifyOtpRequest
import com.example.myapplication.data.remote.chat.ChatSocketManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class RegisterViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState = _uiState.asStateFlow()

    val regions = listOf(
        "Toshkent sh.", "Toshkent v.", "Andijon", "Buxoro", "Farg'ona", 
        "Jizzax", "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", 
        "Qoraqalpog'iston R.", "Samarqand", "Sirdaryo", "Surxondaryo"
    )

    private val districtsMap = mapOf(
        "Toshkent sh." to listOf("Chilonzor", "Yunusobod", "Mirzo Ulug'bek", "Olmazor", "Shayxontohur", "Yakkasaroy"),
        "Toshkent v." to listOf("Chirchiq", "Angren", "Olmaliq", "Bekobod", "Yangiyo'l"),
        "Andijon" to listOf("Andijon sh.", "Asaka", "Shahrixon", "Xonobod"),
        "Buxoro" to listOf("Buxoro sh.", "Gijduvon", "Kogon"),
        "Samarqand" to listOf("Samarqand sh.", "Kattaqo'rg'on", "Urgut")
    )

    fun getDistricts(region: String): List<String> {
        return districtsMap[region] ?: listOf("Tuman tanlanmagan")
    }

    val grades = (1..11).map { it.toString() }
    val groups = listOf("A", "B", "D", "E")

    fun onIdentityChange(identity: String) {
        _uiState.update { it.copy(identity = identity, error = null) }
    }

    fun onOtpChange(otp: String) {
        if (otp.length <= 6) {
            _uiState.update { it.copy(otp = otp, error = null) }
        }
    }

    fun sendOtp() {
        val identity = _uiState.value.identity.trim()
        
        val emailPattern = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$"
        val isEmail = identity.matches(emailPattern.toRegex())
        val isPhone = identity.startsWith("+998") && identity.length == 13 && identity.substring(1).all { it.isDigit() }

        if (!isEmail && !isPhone) {
            _uiState.update { it.copy(error = "To'g'ri email yoki telefon raqami kiriting") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.sendOtp(
                        OtpRequest(identity = identity, purpose = "register")
                    )
                }
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, currentStep = 2, error = null) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update { it.copy(isLoading = false, error = "Kod yuborilmadi (${response.code()}): ${body ?: ""}") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun loginWithGoogle(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            _uiState.update { it.copy(isLoading = false, error = "Google ro'yxatdan o'tish login bo'limidan ishlatiladi") }
        }
    }

    fun verifyOtp() {
        if (_uiState.value.otp.length != 6) {
            _uiState.update { it.copy(error = "6 xonali kodni kiriting") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.verifyOtp(
                        VerifyOtpRequest(
                            identity = _uiState.value.identity.trim(),
                            otp = _uiState.value.otp,
                            purpose = "register"
                        )
                    )
                }
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, currentStep = 3, error = null) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update { it.copy(isLoading = false, error = "Kod noto'g'ri (${response.code()}): ${body ?: ""}") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun updateField(field: RegisterField) {
        _uiState.update { state ->
            when (field) {
                is RegisterField.FullName -> state.copy(fullName = field.value)
                is RegisterField.Username -> state.copy(username = field.value)
                is RegisterField.Region -> state.copy(selectedRegion = field.value, selectedDistrict = "", selectedSchool = "")
                is RegisterField.District -> state.copy(selectedDistrict = field.value, selectedSchool = "")
                is RegisterField.School -> state.copy(selectedSchool = field.value)
                is RegisterField.Grade -> state.copy(grade = field.value)
                is RegisterField.Group -> state.copy(group = field.value)
                is RegisterField.Gender -> state.copy(gender = field.value)
                is RegisterField.BirthDate -> state.copy(birthDay = field.day, birthMonth = field.month, birthYear = field.year)
                is RegisterField.Password -> state.copy(password = field.value)
                is RegisterField.ConfirmPassword -> state.copy(confirmPassword = field.value)
            }
        }
    }

    fun register(context: Context) {
        val state = _uiState.value
        if (state.fullName.isBlank() || state.username.isBlank() || state.password.isBlank()) {
            _uiState.update { it.copy(error = "Barcha maydonlarni to'ldiring") }
            return
        }
        if (state.password != state.confirmPassword) {
            _uiState.update { it.copy(error = "Parollar mos kelmadi") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.register(
                        FullRegisterRequest(
                            identity = state.identity.trim(),
                            otp = state.otp,
                            password = state.password,
                            fullName = state.fullName.trim(),
                            username = state.username.trim(),
                            region = state.selectedRegion.trim(),
                            district = state.selectedDistrict.trim(),
                            school = state.selectedSchool.trim(),
                            grade = state.grade.trim(),
                            group = state.group.trim()
                        )
                    )
                }
                if (response.isSuccessful) {
                    val data = response.body()?.getAsJsonObject("data")
                    val access = data?.get("accessToken")?.asString
                    val refresh = data?.get("refreshToken")?.asString
                    if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
                        AuthSession.accessToken = access
                        ChatSocketManager.updateAccessToken(access)
                        TokenManager(context).saveTokens(access, refresh)
                    }
                    _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                } else {
                    val body = response.errorBody()?.string()?.take(250)
                    _uiState.update { it.copy(isLoading = false, error = "Ro'yxatdan o'tish xatosi (${response.code()}): ${body ?: ""}") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun prevStep() {
        if (_uiState.value.currentStep > 1) {
            _uiState.update { it.copy(currentStep = it.currentStep - 1, error = null) }
        }
    }
}

sealed class RegisterField {
    data class FullName(val value: String) : RegisterField()
    data class Username(val value: String) : RegisterField()
    data class Region(val value: String) : RegisterField()
    data class District(val value: String) : RegisterField()
    data class School(val value: String) : RegisterField()
    data class Grade(val value: String) : RegisterField()
    data class Group(val value: String) : RegisterField()
    data class Gender(val value: String) : RegisterField()
    data class BirthDate(val day: String, val month: String, val year: String) : RegisterField()
    data class Password(val value: String) : RegisterField()
    data class ConfirmPassword(val value: String) : RegisterField()
}

data class RegisterUiState(
    val currentStep: Int = 1,
    val identity: String = "",
    val otp: String = "",
    val fullName: String = "",
    val username: String = "",
    val selectedRegion: String = "",
    val selectedDistrict: String = "",
    val selectedSchool: String = "",
    val grade: String = "",
    val group: String = "",
    val gender: String = "",
    val birthDay: String = "",
    val birthMonth: String = "",
    val birthYear: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)
