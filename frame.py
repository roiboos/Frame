##
 #  @filename   :   main.cpp
 #  @brief      :   7.5inch e-paper display demo
 #  @author     :   Yehui from Waveshare
 #
 #  Copyright (C) Waveshare     July 28 2017
 #
 # Permission is hereby granted, free of charge, to any person obtaining a copy
 # of this software and associated documnetation files (the "Software"), to deal
 # in the Software without restriction, including without limitation the rights
 # to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 # copies of the Software, and to permit persons to  whom the Software is
 # furished to do so, subject to the following conditions:
 #
 # The above copyright notice and this permission notice shall be included in
 # all copies or substantial portions of the Software.
 #
 # THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 # IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 # FITNESS OR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 # AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 # LIABILITY WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 # OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 # THE SOFTWARE.
 ##

import epd5in83b
import json
import hashlib
import time
from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont

EPD_WIDTH = 600
EPD_HEIGHT = 448

def main():
    last_hash = ''
    epd = epd5in83b.EPD()

    while True:
        with open('data.json', 'r') as read_file:
            data = json.load(read_file) 
        with open('data.json', 'r') as read_file:
            content = read_file.read();

        hash_returned = hashlib.md5(content.encode('utf-8')).hexdigest()
        print(hash_returned)
        print(last_hash)
        if hash_returned != last_hash:
            print('Hash changed')
            last_hash = hash_returned

            epd.init()

            # For simplicity, the arguments are explicit numerical coordinates
            image_red = Image.new('1', (600, 448), 255)    # 255: clear the frame
            draw_red = ImageDraw.Draw(image_red)

            font_weekday = ImageFont.truetype('./publicsans-regular.ttf', 48)
            font_day = ImageFont.truetype('./publicsans-bold.ttf', 120) 
            font_month = ImageFont.truetype('./publicsans-regular.ttf', 24)
            font_cal_day = ImageFont.truetype('./publicsans-regular.ttf', 16)
            font_garbage = ImageFont.truetype('./publicsans-regular.ttf', 20)
            font_garbage_warn = ImageFont.truetype('./publicsans-bold.ttf', 20)
            font_temp_current = ImageFont.truetype('./publicsans-regular.ttf', 48)
            font_temp_forecast = ImageFont.truetype('./publicsans-regular.ttf', 20)
            # display images
            image_black = Image.open('display_black.bmp')
            draw_black = ImageDraw.Draw(image_black);

            day_of_week = data['today']['dayofweek']
            (width, height) = font_weekday.getsize(day_of_week);
            draw_black.text(((242-width)/2, 33), day_of_week, font = font_weekday, fill = 255)

            day = data['today']['day'];
            draw_black.text((82, 72), day, font = font_day, fill = 255)

            month = data['today']['month'] + ' ' + data['today']['year']
            (width, height) = font_month.getsize(month)
            draw_black.text(((242-width)/2, 210), month, font = font_month, fill = 255)

            base = data['calendar']['first']
            days_in_month = data['calendar']['days'] 
            for i in range(base, days_in_month + 1 + base):
                draw_black.text(((16+((i-1) % 7)*32), 309 + ((i-1)//7*28)), str(i-base+1), font = font_cal_day, fill = 255)

            garbage_rest = data['garbage']['rest'];
            if garbage_rest == 'MORGEN' or garbage_rest == 'HEUTE':
                draw_red.text((379, 172), garbage_rest, font = font_garbage_warn, fill = 0)
            else:
                draw_black.text((379, 172), data['garbage']['rest'], font = font_garbage, fill = 0)
            
            garbage_papier = data['garbage']['papier']
            if garbage_papier == 'MORGEN' or garbage_papier == 'HEUTE':
                draw_red.text((379, 201), garbage_papier, font = font_garbage_warn, fill = 0)
            else:
                draw_black.text((379, 201), data['garbage']['papier'], font = font_garbage, fill = 0)

            draw_black.text((414, 300), data['weather']['current']['temperature'], font = font_temp_current, fill = 0)
            draw_black.text((280, 410), data['weather']['morning']['temperature'], font = font_temp_forecast, fill = 0)
            draw_black.text((365, 410), data['weather']['afternoon']['temperature'], font = font_temp_forecast, fill = 0)
            draw_black.text((450, 410), data['weather']['evening']['temperature'], font = font_temp_forecast, fill = 0)
            draw_black.text((530, 410), data['weather']['night']['temperature'], font = font_temp_forecast, fill = 0)
    #image_closed = Image.open('closed.bmp')
    #image_open = Image.open('open.bmp')
    #image_black.paste(image_closed, (100, 100))
    #image_red.paste(image_open, (300, 50))
            epd.display_frame(epd.get_frame_buffer(image_black),epd.get_frame_buffer(image_red))
            epd.wait_until_idle()
            epd.sleep()
        
        else:
            print('Nothing changed')

        time.sleep(10)
    
    exit()

if __name__ == '__main__':
    main()
