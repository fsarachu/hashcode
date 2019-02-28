const lineReader = require('line-reader');
// const fileName = 'input_data/e_shiny_selfies.txt';
const fileName = 'input_data/b_example.txt';
const fs = require('fs');

function readPhotos(filename) {
    return new Promise((res) => {
        const photos = [];
        const allTags = new Map();

        let i = 0;
        lineReader.eachLine(fileName, function (line, last) {
            i += 1;
            if (i !== 1) {
                const [orientation, tagCount, ...tags] = line.split(' ');

                for (const tag of tags) {
                    const count = allTags.has(tag) ? allTags.get(tag).count + 1 : 1;
                    allTags.set(tag, {count});
                }

                const photo = {i: i - 2, orientation, tags, tagCount: parseInt(tagCount, 10)};
                photos.push(photo);
            }

            const sortedTags = new Map([...allTags.entries()].sort((a, b) => b[1].count - a[1].count));

            if (last) {
                res({photos, sortedTags});
            }
        });
    });

}

function getMaxCount(sortedTags) {
    const [, {count: max}] = [...sortedTags.entries()][0];
    return max;
}

function getMinCount(sortedTags) {
    const [, {count: min}] = [...sortedTags.entries()][sortedTags.size - 1];
    return min;
}

function getDistance(count, min, max) {
    return [max - count, min - count];
}

function getVerticalSlideScore(slide) {
    const s = slide.photos[0].similarity;
    const d = slide.photos[1].diversity;
    const a = s + d;
    const tagCount = slide.photos[0].tags.length + slide.photos[1].tags.length;
    const balance = s === 0 || d === 0 ? 0 : Math.min(s / d, d / s);
    const score = balance * a + tagCount * 0.1;
    return score;
}

function getHorizontalSlideScore(slide) {
    const s = slide.photos[0].similarity;
    const d = slide.photos[0].diversity;
    const a = s + d;
    const tagCount = slide.photos[0].tags.length;
    const balance = s === 0 || d === 0 ? 0 : Math.min(s / d, d / s);
    const score = balance * a + tagCount * 0.1;
    return score;
}

readPhotos(fileName)
    .then(({photos, sortedTags}) => {
        const min = getMinCount(sortedTags);
        const max = getMaxCount(sortedTags);

        // Add similarity and diversity
        for (let [tag, data] of sortedTags) {
            const distance = getDistance(data.count, min, max);
            const similarity = max === min ? 1 : 1 - distance[0] / (max - min);
            const diversity = max === min ? 1 : 1 - distance[1] / (min - max);
            data.similarity = similarity;
            data.diversity = diversity;
        }

        const verticalPhotos = photos.filter(p => p.orientation === 'V');
        const horizontalPhotos = photos.filter(p => p.orientation === 'H');

        for (const verticalPhoto of verticalPhotos) {
            let similarity = 0;
            let diversity = 0;

            for (const tag of verticalPhoto.tags) {
                similarity += sortedTags.get(tag).similarity;
                diversity += sortedTags.get(tag).diversity;
            }

            verticalPhoto.similarity = similarity;
            verticalPhoto.diversity = diversity;
        }

        for (const horizontalPhoto of horizontalPhotos) {
            let similarity = 0;
            let diversity = 0;

            for (const tag of horizontalPhoto.tags) {
                similarity += sortedTags.get(tag).similarity;
                diversity += sortedTags.get(tag).diversity;
            }

            horizontalPhoto.similarity = similarity;
            horizontalPhoto.diversity = diversity;
        }

        const verticalSortedBySimilarity = [...verticalPhotos].sort((a, b) => {
            if (a.similarity > b.similarity) {
                return -1;
            }
            if (a.similarity < b.similarity) {
                return 1;
            }
            // a must be equal to b
            return 0;
        });
        const verticalSortedByDiversity = [...verticalPhotos].sort((a, b) => {
            if (a.diversity > b.diversity) {
                return -1;
            }
            if (a.diversity < b.diversity) {
                return 1;
            }
            // a must be equal to b
            return 0;
        });

        // Build and add vertical slides
        const slides = [];

        // TODO: check loop, use while(?
        for (let i = 0; i < verticalPhotos.length; i++) {
            if (verticalSortedBySimilarity.length === 1)
                break;

            let p1 = verticalSortedBySimilarity.shift();
            let p2 = verticalSortedByDiversity.shift();

            if (p1.i === p2.i) {
                const temp = p2;
                p2 = verticalSortedByDiversity.shift();
                verticalSortedByDiversity.unshift(temp);
            }

            const photos = [p1, p2];

            slides.push({photos, orientation: 'V'});
        }

        // Add horizontal slides
        for (const horizontalPhoto of horizontalPhotos) {
            slides.push({photos: [horizontalPhoto], orientation: 'H'})
        }

        // Add slide score
        for (const slide of slides) {
            slide.score = slide.orientation === 'V' ? getVerticalSlideScore(slide) : getHorizontalSlideScore(slide);
        }

        slides.sort((a, b) => b.score - a.score);

        console.log('------');
        console.log(slides);
        console.log('------');

        fs.appendFileSync('out.txt', `${slides.length}\n`);
        for (const slide of slides) {
            const line = slide.orientation === 'V' ? `${slide.photos[0].i} ${slide.photos[1].i}\n` : `${slide.photos[0].i}\n`;
            fs.appendFileSync('out.txt', line);
        }

    });