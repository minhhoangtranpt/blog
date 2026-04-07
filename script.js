import pandas as pd

# Giả sử bạn đã đọc dữ liệu từ file txt vào một DataFrame có tên là 'df'
# và dữ liệu có cột 'Time (s)' cùng với cột lực Fz tổng, ví dụ đặt tên là 'TOTAL_Fz'

# ==========================================
# 1. TÍNH T1: Thời điểm Fz lớn nhất trong 10 giây đầu
# ==========================================
# Lọc dữ liệu trong 10 giây đầu tiên
df_10s = df[df['Time (s)'] <= 10.0]

# Tìm chỉ mục (index) nơi Fz đạt giá trị lớn nhất
T1_idx = df_10s['TOTAL_Fz'].idxmax()

# Lấy giá trị thời gian T1 và Fz tại thời điểm đó
T1 = df.loc[T1_idx, 'Time (s)']
max_Fz_10s = df.loc[T1_idx, 'TOTAL_Fz']


# ==========================================
# 2. TÍNH T0: Thời điểm Fz nhỏ hơn 2.5% của trung bình Fz trong 5 giây đầu
# ==========================================
# Lọc dữ liệu trong 5 giây đầu tiên để tính trung bình
df_5s = df[df['Time (s)'] <= 5.0]
mean_Fz_5s = df_5s['TOTAL_Fz'].mean()

# LƯU Ý VỀ NGƯỠNG T0:
# Trong phân tích sinh cơ học (ví dụ: xác định thời điểm bắt đầu chuyển động onset of movement), 
# điều kiện này thường có nghĩa là lực Fz "giảm đi 2.5% so với trọng lượng cơ thể tĩnh" 
# (tức là Fz rớt xuống dưới mức 97.5% của trung bình).
# - Nếu bạn muốn tính theo nghĩa đen (nhỏ hơn mức 2.5%): threshold_T0 = 0.025 * mean_Fz_5s
# - Nếu bạn muốn tính ngưỡng giảm 2.5% (còn 97.5%): threshold_T0 = 0.975 * mean_Fz_5s

# Ở đây tôi thiết lập theo ngưỡng giảm 2.5% (thường dùng trong nghiên cứu lâm sàng)
threshold_T0 = 0.975 * mean_Fz_5s 
# Nếu bạn thực sự cần theo nghĩa đen, hãy đổi thành: threshold_T0 = 0.025 * mean_Fz_5s

# Lọc các dòng thời gian mà Fz rớt xuống dưới ngưỡng này
df_below_threshold = df[df['TOTAL_Fz'] < threshold_T0]

# Lấy thời điểm T0 đầu tiên thỏa mãn điều kiện
if not df_below_threshold.empty:
    # Lấy index của dòng đầu tiên thỏa mãn
    T0_idx = df_below_threshold.index[0]
    T0 = df.loc[T0_idx, 'Time (s)']
else:
    T0 = None # Trả về None nếu không có thời điểm nào lực rớt xuống dưới ngưỡng này

# ==========================================
# IN KẾT QUẢ
# ==========================================
print(f"--- KẾT QUẢ PHÂN TÍCH ---")
print(f"Trung bình Fz (0-5s): {mean_Fz_5s:.2f} N")
print(f"Ngưỡng xét T0 (97.5%): {threshold_T0:.2f} N")
print(f"T0: {T0} s")
print(f"T1: {T1} s (với Fz cực đại = {max_Fz_10s:.2f} N)")
