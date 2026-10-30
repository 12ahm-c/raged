"""يحوّل logo.jpg إلى assets/logo.png شفاف الخلفية (قصّ + إزالة الخلفية من الحواف)."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = r"C:\Users\HP\Desktop\projects\raged\logo.jpg"
DST = r"C:\Users\HP\Desktop\projects\raged\raghad-app\assets\logo.png"

img = Image.open(SRC).convert("RGB")
arr = np.asarray(img).astype(np.int16)

# الخلفية: رمادي/أبيض فاتح جدًا (تدرّج بسيط) مع ظل خفيف أسفل الشعار
bg_mask = arr.min(axis=2) > 228

# ابقاء فقط ما يتصل بالحدود (يزيل الشعار الأبيض الداخلي عن طريق الخطأ)
lab, n = ndimage.label(bg_mask)
border_labels = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
border_labels.discard(0)
background = np.isin(lab, list(border_labels))

alpha = np.where(background, 0, 255).astype(np.uint8)

# تنعيم الحواف
alpha_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(0.8))
alpha = np.asarray(alpha_img)

rgba = np.dstack([np.asarray(img), alpha])
out = Image.fromarray(rgba, mode="RGBA")

# قصّ حول المحتوى
ys, xs = np.where(alpha > 12)
pad = 6
top, bottom = max(ys.min() - pad, 0), min(ys.max() + pad + 1, out.height)
left, right = max(xs.min() - pad, 0), min(xs.max() + pad + 1, out.width)
out = out.crop((left, top, right, bottom))
out.save(DST)
print("saved", DST, out.size, "opaque px:", int((np.asarray(out)[..., 3] > 12).sum()))
