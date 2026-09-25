# Sudoku

Game Sudoku chạy trên web, viết bằng HTML + CSS + JavaScript thuần. Không framework, không bước build, không thư viện ngoài. Mở `index.html` là chơi được.

## Tính năng

- Sinh đề ngẫu nhiên: tạo lưới đầy bằng backtracking, rồi xóa ô và kiểm tra nghiệm duy nhất bằng solver. Mọi đề sinh ra đều có đúng một nghiệm.
- 5 độ khó theo số ô cho trước: Dễ (40) / Trung bình (34) / Khó (29) / Chuyên gia (25) / Cực khó (22).
- Khóa độ khó: phải thắng 3 ván ở độ khó hiện tại để mở độ khó tiếp theo. Tiến trình lưu trong trình duyệt.
- Đếm lỗi, tối đa 3 lỗi thì thua. Số sai được so với đáp án và tô đỏ.
- Hiển thị tiến độ: số ô đã điền đúng / tổng số ô trống, kèm thanh tiến độ.
- Timer, tạm dừng (che bàn cờ), tự tạm dừng khi chuyển tab.
- Ghi chú (bút chì): số nhỏ trong ô, tự xóa ghi chú liên quan khi điền đúng vào hàng / cột / vùng.
- Hoàn tác, Xóa.
- Gợi ý có giải thích (1 lượt mỗi ván): tìm ô suy ra được bằng kỹ thuật cơ bản, giải thích vì sao và đánh dấu các ô liên quan trên bàn cờ. Thứ tự ưu tiên: chỉ ra ô đang sai → ô chỉ còn một số khả dĩ → số chỉ có một vị trí trong hàng/cột/vùng → nếu không có bước đơn giản thì cho đáp án của ô đang chọn. Người chơi có thể "Điền số" hoặc "Tự điền".
- Bàn phím số 1–9 hiện số lượng còn lại, ẩn khi đã đủ 9.
- Nhấp ô: tô sáng hàng, cột, vùng 3x3 và các ô cùng số.
- Tự lưu ván đang chơi vào `localStorage`, mở lại trang thì tiếp tục.
- Màn hình thắng (thời gian, độ khó, lỗi, thông báo mở khóa) và màn hình thua (chơi lại / ván mới).
- Giao diện tiếng Việt, responsive trên điện thoại, dark mode theo hệ thống.

## Phím tắt

| Phím | Chức năng |
| --- | --- |
| `1`–`9` | Điền số (hoặc ghi chú khi bật chế độ ghi chú) |
| `Backspace` / `Delete` / `0` | Xóa ô |
| Phím mũi tên | Di chuyển ô đang chọn |
| `N` | Bật / tắt ghi chú |
| `Z` | Hoàn tác |
| `H` | Gợi ý |
| `P` / `Esc` | Tạm dừng / tiếp tục |

## Cấu trúc

```
index.html      Khung trang, modal
style.css       Giao diện, dark mode, responsive
engine.js       Engine: sinh đề, solver backtracking, solver theo kỹ thuật, chấm độ khó, PRNG có seed
app.js          Logic game + render (cần engine.js nạp trước)
sudoku-test.js  Test engine chạy bằng Node
```

Số ván cần thắng để mở khóa mỗi độ khó nằm trong hằng `DIFFICULTIES` (trường `unlockWins`), mức kỹ thuật yêu cầu của từng độ khó (`minLevel` / `maxLevel`), số lượt gợi ý mỗi ván (`MAX_HINTS`) và lịch độ khó ván hằng ngày theo thứ (`DAILY_BY_WEEKDAY`) đều ở đầu `app.js`. Danh sách kỹ thuật và mức của chúng nằm trong `TECHNIQUES` ở `engine.js`.

## Cách chấm độ khó

Sau khi sinh đề, engine giải lại đề bằng các kỹ thuật suy luận theo thứ tự từ dễ đến khó và ghi nhận mức cao nhất phải dùng:

| Mức | Kỹ thuật | Độ khó |
| --- | --- | --- |
| 1 | Ô chỉ còn một số, số chỉ có một vị trí | Dễ (40 ô cho trước), Trung bình (34 ô) |
| 2 | Cặp chỉ hướng, rút gọn theo hàng/cột, cặp trần | Khó |
| 3 | Cặp ẩn, bộ ba trần / ẩn, X-Wing, XY-Wing, Swordfish | Chuyên gia |
| 4 | Bế tắc với mọi kỹ thuật trên (cần chuỗi suy luận / thử sai) | Cực khó |

Đề không đúng mức sẽ bị bỏ và sinh lại (tối đa 60 lần, thường dưới 100 ms). Gợi ý dùng cùng solver này nên luôn giải thích được bước tiếp theo bằng kỹ thuật tương ứng, kể cả các bước loại trừ ứng viên.

## Ván hằng ngày

Mỗi ngày có một đề chung cho mọi người chơi: seed sinh từ ngày (`sudoku-daily-YYYY-MM-DD`) qua PRNG mulberry32, nên cùng ngày thì mọi máy sinh ra cùng đề. Độ khó theo thứ: T2 Dễ, T3–T4 Trung bình, T5–T6 Khó, T7 Chuyên gia, CN Cực khó. Ván hằng ngày không cần mở khóa và không tính vào tiến trình mở khóa; kết quả lưu vào chuỗi ngày trong Thống kê.

## Kiểm tra engine

```bash
node sudoku-test.js 30
```

Script sinh 30 đề cho mỗi độ khó và kiểm tra: đáp án hợp lệ, đề khớp đáp án, đề có đúng một nghiệm, solver giải lại đúng đáp án.

## Chạy cục bộ

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy một static server bất kỳ:

```bash
npx serve .
```

## Deploy lên GitHub Pages

1. Push code lên GitHub, nhánh `main`.
2. Vào repo trên GitHub: **Settings → Pages**.
3. Ở mục **Build and deployment**, chọn **Source: Deploy from a branch**.
4. Chọn **Branch: `main`**, thư mục **`/ (root)`**, bấm **Save**.
5. Đợi khoảng 1 phút, trang sẽ có tại `https://<tên-user>.github.io/<tên-repo>/`.

Mọi đường dẫn trong dự án đều là đường dẫn tương đối nên chạy được ở bất kỳ sub-path nào.
