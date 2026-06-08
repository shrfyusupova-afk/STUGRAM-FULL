package com.example.myapplication.ui.home

import androidx.compose.foundation.text.ClickableText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Caption matnida #hashtag va @mention so'zlarini ajratib aniqlanadi va
 * ularga klikni `onHashtagClick` / `onMentionClick` callback'lariga uzatadi.
 *
 * Boshqa joylarda (oddiy matn) bosish `onTextClick`ni chaqiradi.
 */
@Composable
fun ClickableHashtagMentionText(
    text: String,
    textColor: Color,
    linkColor: Color = Color(0xFF00A3FF),
    fontSize: TextUnit = 13.sp,
    maxLines: Int = Int.MAX_VALUE,
    modifier: Modifier = Modifier,
    onHashtagClick: (String) -> Unit,
    onMentionClick: (String) -> Unit,
    onTextClick: () -> Unit = {}
) {
    val annotated = buildHashtagMentionAnnotated(text, textColor, linkColor)
    ClickableText(
        text = annotated,
        modifier = modifier,
        style = TextStyle(color = textColor, fontSize = fontSize),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        onClick = { offset ->
            val hashtag = annotated.getStringAnnotations(tag = "hashtag", start = offset, end = offset)
                .firstOrNull()
            val mention = annotated.getStringAnnotations(tag = "mention", start = offset, end = offset)
                .firstOrNull()
            when {
                hashtag != null -> onHashtagClick(hashtag.item)
                mention != null -> onMentionClick(mention.item)
                else -> onTextClick()
            }
        }
    )
}

private fun buildHashtagMentionAnnotated(
    text: String,
    textColor: Color,
    linkColor: Color
): AnnotatedString = buildAnnotatedString {
    val regex = Regex("([#@])([\\p{L}\\p{N}_]+)")
    var last = 0
    for (match in regex.findAll(text)) {
        if (match.range.first > last) {
            withStyle(SpanStyle(color = textColor)) {
                append(text.substring(last, match.range.first))
            }
        }
        val symbol = match.groupValues[1]
        val word = match.groupValues[2]
        val tag = if (symbol == "#") "hashtag" else "mention"
        pushStringAnnotation(tag = tag, annotation = word)
        withStyle(SpanStyle(color = linkColor, fontWeight = FontWeight.SemiBold)) {
            append(match.value)
        }
        pop()
        last = match.range.last + 1
    }
    if (last < text.length) {
        withStyle(SpanStyle(color = textColor)) {
            append(text.substring(last))
        }
    }
}
