package com.example.myapplication.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostMoreMenuSheet(
    isOwn: Boolean,
    postId: String,
    onDismiss: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onReport: () -> Unit = {},
    onBlock: () -> Unit = {}
) {
    val sheetState = rememberModalBottomSheetState()
    val clipboard = LocalClipboardManager.current

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF161616),
        dragHandle = {
            Box(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.width(38.dp).height(4.dp).background(Color.White.copy(0.25f), RoundedCornerShape(2.dp)))
            }
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = 12.dp)
        ) {
            PostMenuRow(
                icon = Icons.Default.Link,
                label = "Havolani nusxalash",
                onClick = {
                    clipboard.setText(AnnotatedString("https://stugram.app/p/$postId"))
                    onDismiss()
                }
            )

            if (isOwn) {
                PostMenuRow(icon = Icons.Default.Edit, label = "Tahrirlash", onClick = onEdit)
                PostMenuRow(
                    icon = Icons.Default.DeleteOutline,
                    label = "O'chirish",
                    tint = Color(0xFFFF5252),
                    onClick = onDelete
                )
            } else {
                PostMenuRow(
                    icon = Icons.Default.Flag,
                    label = "Shikoyat qilish",
                    tint = Color(0xFFFF5252),
                    onClick = { onReport(); onDismiss() }
                )
                PostMenuRow(
                    icon = Icons.Default.Block,
                    label = "Bloklash",
                    tint = Color(0xFFFF5252),
                    onClick = { onBlock(); onDismiss() }
                )
            }
        }
    }
}

@Composable
private fun PostMenuRow(icon: ImageVector, label: String, tint: Color = Color.White, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(label, color = tint, fontSize = 15.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun EditCaptionDialog(
    initialCaption: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var draft by remember { mutableStateOf(initialCaption) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        title = { Text("Captionni tahrirlash", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedBorderColor = Color(0xFF00A3FF),
                    unfocusedBorderColor = Color.White.copy(0.2f)
                )
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(draft.trim()) }, enabled = draft.isNotBlank()) {
                Text("Saqlash", color = Color(0xFF00A3FF), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Bekor", color = Color.White.copy(0.6f)) }
        }
    )
}

@Composable
fun ConfirmDeleteDialog(
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1A),
        title = { Text("Postni o'chirish", color = Color.White, fontWeight = FontWeight.Bold) },
        text = { Text("Bu amalni qaytarib bo'lmaydi. Davom etilsinmi?", color = Color.White.copy(0.85f)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("O'chirish", color = Color(0xFFFF5252), fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Bekor", color = Color.White.copy(0.6f)) }
        }
    )
}
