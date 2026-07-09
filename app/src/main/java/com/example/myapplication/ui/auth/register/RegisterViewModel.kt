package com.example.myapplication.ui.auth.register

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.example.myapplication.core.storage.TokenManager
import com.example.myapplication.data.remote.AuthSession
import com.example.myapplication.data.remote.FullRegisterRequest
import com.example.myapplication.data.remote.OtpRequest
import com.example.myapplication.data.remote.RetrofitClient
import com.example.myapplication.data.remote.VerifyOtpRequest
import com.example.myapplication.data.remote.chat.ChatSocketManager
import com.google.gson.JsonObject
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
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

    // --- Telegram orqali ro'yxatdan o'tish ---
    // 1) Backend link-kod yaratadi; 2) foydalanuvchi Telegram botga o'tib
    // raqamini ulashadi; 3) shu vaqtda app link-status'ni kuzatib turadi va
    // bog'langach avtomatik 3-bosqichga (profil ma'lumotlari) o'tadi.

    private var telegramPollJob: Job? = null

    fun startTelegramRegistration(context: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.createTelegramLinkCode()
                }
                if (!response.isSuccessful) {
                    val body = response.errorBody()?.string()?.take(200)
                    _uiState.update { it.copy(isLoading = false, error = "Telegram bilan ulanib bo'lmadi (${response.code()}): ${body ?: ""}") }
                    return@launch
                }
                val data = response.body()?.getAsJsonObject("data")
                val code = data?.get("code")?.takeIf { !it.isJsonNull }?.asString
                val deepLink = data?.get("deepLink")?.takeIf { !it.isJsonNull }?.asString
                if (code.isNullOrBlank() || deepLink.isNullOrBlank()) {
                    _uiState.update { it.copy(isLoading = false, error = "Telegram ro'yxatdan o'tish hozircha sozlanmagan") }
                    return@launch
                }
                _uiState.update { it.copy(isLoading = false, telegramWaiting = true, telegramDeepLink = deepLink) }
                openTelegramLink(context, deepLink)
                startTelegramPolling(context, code)
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
        }
    }

    fun reopenTelegram(context: Context) {
        _uiState.value.telegramDeepLink?.let { openTelegramLink(context, it) }
    }

    fun cancelTelegramRegistration() {
        telegramPollJob?.cancel()
        telegramPollJob = null
        _uiState.update { it.copy(telegramWaiting = false, error = null) }
    }

    private fun openTelegramLink(context: Context, link: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            _uiState.update { it.copy(error = "Telegram ilovasi ochilmadi. Telegram o'rnatilganini tekshiring.") }
        }
    }

    /**
     * Applies a /telegram/link-status response to the UI state.
     * Returns true once the link is resolved (registered elsewhere, or ready
     * to continue to step 3) so the caller can stop polling/retrying.
     */
    private fun applyLinkStatusData(context: Context, data: JsonObject): Boolean {
        if (data.get("linked")?.asBoolean != true) return false

        if (data.get("alreadyRegistered")?.asBoolean == true) {
            // Possession of the Telegram chat was just proven, so if the
            // backend handed back a real session, log the user straight in
            // instead of dead-ending on an error.
            val access = data.get("accessToken")?.takeIf { !it.isJsonNull }?.asString
            val refresh = data.get("refreshToken")?.takeIf { !it.isJsonNull }?.asString
            if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
                AuthSession.accessToken = access
                ChatSocketManager.updateAccessToken(access)
                TokenManager(context).saveTokens(access, refresh)
                _uiState.update { it.copy(isLoading = false, telegramWaiting = false, isSuccess = true) }
                return true
            }

            val existing = data.get("existingUsername")?.takeIf { !it.isJsonNull }?.asString
            _uiState.update {
                it.copy(
                    isLoading = false,
                    telegramWaiting = false,
                    error = "Siz allaqachon ro'yxatdan o'tgansiz" +
                        (if (!existing.isNullOrBlank()) " (@$existing)" else "") +
                        ". \"Kirish\" bo'limidan kiring."
                )
            }
            return true
        }

        val identity = data.get("identity")?.takeIf { !it.isJsonNull }?.asString
        val otp = data.get("otp")?.takeIf { !it.isJsonNull }?.asString
        val phone = data.get("phoneNumber")?.takeIf { !it.isJsonNull }?.asString ?: ""
        if (identity.isNullOrBlank() || otp.isNullOrBlank()) return false

        _uiState.update {
            it.copy(
                isLoading = false,
                telegramWaiting = false,
                telegramLinked = true,
                telegramPhone = phone,
                identity = identity,
                otp = otp,
                currentStep = 3,
                error = null
            )
        }
        return true
    }

    private fun startTelegramPolling(context: Context, code: String) {
        telegramPollJob?.cancel()
        telegramPollJob = viewModelScope.launch {
            val deadline = System.currentTimeMillis() + 10 * 60 * 1000L
            while (isActive && System.currentTimeMillis() < deadline) {
                delay(2500)
                try {
                    val response = withContext(Dispatchers.IO) {
                        RetrofitClient.instance.getTelegramLinkStatus(code)
                    }
                    if (response.code() == 404) {
                        _uiState.update { it.copy(telegramWaiting = false, error = "Havola muddati o'tdi. Qaytadan urinib ko'ring.") }
                        return@launch
                    }
                    val data = response.body()?.getAsJsonObject("data") ?: continue
                    if (applyLinkStatusData(context, data)) return@launch
                } catch (_: Exception) {
                    // Vaqtinchalik tarmoq xatosi — kuzatishni davom ettiramiz
                }
            }
            if (_uiState.value.telegramWaiting) {
                _uiState.update { it.copy(telegramWaiting = false, error = "Kutish vaqti tugadi. Qaytadan urinib ko'ring.") }
            }
        }
    }

    // Opened via the Telegram bot's https bridge link (stugram://telegram-register).
    // The bot already linked the code by the time this is tapped, so this is a
    // one-shot fetch rather than a poll.
    fun resumeFromTelegramCode(context: Context, code: String) {
        telegramPollJob?.cancel()
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, telegramWaiting = false, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.instance.getTelegramLinkStatus(code)
                }
                if (response.code() == 404) {
                    _uiState.update { it.copy(isLoading = false, error = "Havola muddati o'tgan. Botda qaytadan \"Ro'yxatdan o'tish\"ni bosing.") }
                    return@launch
                }
                val data = response.body()?.getAsJsonObject("data")
                val resolved = data?.let { applyLinkStatusData(context, it) } ?: false
                if (!resolved) {
                    _uiState.update { it.copy(isLoading = false, error = "Hali tasdiqlanmagan. Botda telefon raqamingizni yuboring.") }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = "Tarmoq xatosi: ${e.message}") }
            }
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
        val state = _uiState.value
        if (state.telegramLinked && state.currentStep == 3) {
            // Telegram oqimida OTP bosqichi yo'q — to'g'ridan-to'g'ri boshiga qaytamiz
            _uiState.update {
                it.copy(
                    currentStep = 1,
                    telegramLinked = false,
                    telegramPhone = "",
                    identity = "",
                    otp = "",
                    error = null
                )
            }
            return
        }
        if (state.currentStep > 1) {
            _uiState.update { it.copy(currentStep = it.currentStep - 1, error = null) }
        }
    }

    override fun onCleared() {
        telegramPollJob?.cancel()
        super.onCleared()
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
    val isSuccess: Boolean = false,
    val telegramWaiting: Boolean = false,
    val telegramLinked: Boolean = false,
    val telegramPhone: String = "",
    val telegramDeepLink: String? = null
)
